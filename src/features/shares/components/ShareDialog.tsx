"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import DeptTag from "@/components/shared/DeptTag"
import CopyLinkButton, { shareUrl } from "@/features/shares/components/CopyLinkButton"
import { exportKpis } from "@/features/kpis/export"
import { exportRisks } from "@/features/risks/export"
import { checkShareAccess, createShare, listShareRecipients } from "@/features/shares/mutations"
import { itemNoun, type ShareItemType, type ShareRecipient } from "@/features/shares/types"

const NOTE_LIMIT = 500
const MAX_ITEMS = 200
const MAX_RECIPIENTS = 20
// Item lines shown in an access warning before "and N more".
const WARNING_LINES = 3
// The scrolling middle of the dialog. It bleeds to the dialog's edges so the
// scrollbar sits there, and the padding keeps focus rings from being clipped.
const BODY = "-mx-4 -my-1 min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-1"

type Item = {
  id: string
  name: string
  departmentCode: string
  /** Risks: reference_number as text, "" when there is none. Display only. */
  ref: string
  /** KPIs: the process, to tell apart two KPIs with the same name. */
  process: string
}

type WarningLine = { id: string; text: string; detail: string | null }

/**
 * One line per item a recipient cannot open. Risk names repeat and hold
 * commas (SRD risks have no statement, so their name is the asset list),
 * so each line leads with the reference, in the risk page's "Ref N" form.
 * A KPI line gets its process only when two lines would otherwise match.
 */
function warningLines(type: ShareItemType, blocked: Item[]): WarningLine[] {
  if (type !== "kpi") {
    return blocked.map((i) => ({ id: i.id, text: i.ref ? `Ref ${i.ref} · ${i.name}` : i.name, detail: null }))
  }
  const seen = new Map<string, number>()
  for (const i of blocked) seen.set(i.name, (seen.get(i.name) ?? 0) + 1)
  return blocked.map((i) => ({
    id: i.id,
    text: i.name,
    detail: (seen.get(i.name) ?? 0) > 1 && i.process ? i.process : null,
  }))
}

/**
 * Names and departments of the ticked ids, read through the export action
 * so they come back under the sender's RLS, whichever period or filter
 * they were ticked under. Only these ids are sent: an id that did not come
 * back is one the sender cannot read, and create_share would refuse it.
 */
async function loadItems(type: ShareItemType, ids: string[], year: number, quarter: string): Promise<Item[] | string> {
  if (type === "kpi") {
    const r = await exportKpis(ids, year, quarter)
    if (!r.ok) return r.message
    return r.rows.map((row) => ({
      id: row.id,
      name: row.kpi,
      departmentCode: row.department,
      ref: "",
      process: row.process,
    }))
  }
  const r = await exportRisks(ids, year, quarter)
  if (!r.ok) return r.message
  return r.rows.map((row) => ({
    id: row.id,
    name: row.riskStatement,
    departmentCode: row.department,
    ref: row.ref,
    process: "",
  }))
}

export default function ShareDialog({
  type,
  ids,
  year,
  quarter,
  onClose,
  onShared,
}: {
  type: ShareItemType
  ids: string[]
  year: number
  quarter: string
  /** Closed without sending, or with nothing more to do. */
  onClose: () => void
  /** Done after a successful share; the list clears its selection. */
  onShared: () => void
}) {
  const [items, setItems] = useState<Item[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [people, setPeople] = useState<ShareRecipient[]>([])
  const [picked, setPicked] = useState<ShareRecipient[]>([])
  const [search, setSearch] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [shared, setShared] = useState<{ id: string; count: number } | null>(null)
  const [pending, startTransition] = useTransition()
  // profileId -> the item ids that person cannot open. Absent while the
  // check is running, or when it failed: no warning rather than a wrong one.
  const [hidden, setHidden] = useState<Record<string, string[]>>({})
  const checked = useRef(new Set<string>())
  // profileIds whose access warning lists every item name, not the first few.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let live = true
    void Promise.all([loadItems(type, ids, year, quarter), listShareRecipients()])
      .then(([loaded, recipients]) => {
        if (!live) return
        if (typeof loaded === "string") setLoadError(loaded)
        else setItems(loaded)
        setPeople(recipients)
      })
      .catch(() => live && setLoadError("The selection could not be loaded. Try again."))
    return () => {
      live = false
    }
  }, [type, ids, year, quarter])

  // Checked once per person picked, against the items as loaded. Sending
  // stays allowed; the warning is so nobody is surprised by a lock row.
  useEffect(() => {
    if (!items || items.length === 0) return
    const itemIds = items.map((i) => i.id)
    for (const p of picked) {
      if (checked.current.has(p.profileId)) continue
      checked.current.add(p.profileId)
      void checkShareAccess(p.profileId, type, itemIds).then((result) => {
        if (result) setHidden((cur) => ({ ...cur, [p.profileId]: result }))
      })
    }
  }, [items, picked, type])

  // A person can sit in several groups; once picked they leave every one.
  const pickedIds = useMemo(() => new Set(picked.map((p) => p.profileId)), [picked])
  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const out: { name: string; people: ShareRecipient[] }[] = []
    for (const p of people) {
      if (pickedIds.has(p.profileId)) continue
      if (q && !p.fullName.toLowerCase().includes(q) && !(p.jobTitle ?? "").toLowerCase().includes(q)) continue
      const last = out[out.length - 1]
      if (last && last.name === p.groupName) last.people.push(p)
      else out.push({ name: p.groupName, people: [p] })
    }
    return out
  }, [people, pickedIds, search])

  const pick = (p: ShareRecipient) => {
    if (picked.length >= MAX_RECIPIENTS) return
    setPicked((cur) => [...cur, p])
    setSearch("")
  }
  const unpick = (id: string) => setPicked((cur) => cur.filter((p) => p.profileId !== id))
  const toggleExpanded = (id: string) =>
    setExpanded((cur) => {
      const next = new Set(cur)
      if (!next.delete(id)) next.add(id)
      return next
    })

  const tooMany = (items?.length ?? 0) > MAX_ITEMS
  const warnings = picked
    .map((p) => ({ person: p, ids: hidden[p.profileId] ?? [] }))
    .filter((w) => w.ids.length > 0)

  const canShare = !!items && items.length > 0 && !tooMany && picked.length > 0 && !pending

  const handleShare = () => {
    if (!items) return
    setError(null)
    startTransition(async () => {
      const result = await createShare({
        type,
        ids: items.map((i) => i.id),
        recipients: picked.map((p) => p.profileId),
        note,
        year,
        quarter,
      })
      if (result.ok) setShared({ id: result.shareId, count: picked.length })
      else setError(result.message)
    })
  }

  const noun = itemNoun(type, items?.length ?? ids.length)

  return (
    <Dialog open onOpenChange={(open) => !open && (shared ? onShared() : onClose())}>
      {/* Header and footer stay put; the body between them scrolls, so a
          long selection or several warnings never push the title or the
          buttons off screen. */}
      <DialogContent className="flex max-h-[calc(100dvh-48px)] flex-col sm:max-w-lg">
        {shared ? (
          <>
            <DialogHeader className="shrink-0">
              <DialogTitle>
                Shared with {shared.count} {shared.count === 1 ? "person" : "people"}
              </DialogTitle>
              <DialogDescription>
                They&apos;ll see it under Shared with you, and in their notifications.
                To send it in Teams or an email, copy the link.
              </DialogDescription>
            </DialogHeader>
            <div className={BODY}>
              <Input
                readOnly
                value={shareUrl(shared.id)}
                aria-label="Link to the share"
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono text-xs"
              />
            </div>
            <DialogFooter className="shrink-0">
              <CopyLinkButton shareId={shared.id} />
              <Button onClick={onShared}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="shrink-0">
              <DialogTitle>
                Share {items?.length ?? ids.length} {noun}
              </DialogTitle>
              <DialogDescription>
                {quarter} {year}. Sharing doesn&apos;t change what anyone can open.
              </DialogDescription>
            </DialogHeader>

            <div className={BODY}>
              {/* The selection */}
              {loadError ? (
                <p className="text-sm text-destructive">{loadError}</p>
              ) : !items ? (
                <p className="text-sm text-muted-foreground">Loading…</p>
              ) : (
                <ul className="max-h-36 space-y-1 overflow-y-auto rounded-md border p-2">
                  {items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <DeptTag code={item.departmentCode} />
                      <span className="truncate" title={item.name}>{item.name}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tooMany && (
                <p className="text-sm text-destructive">
                  You can share up to {MAX_ITEMS} at a time. Untick some and try again.
                </p>
              )}

              {/* Share with */}
              <div className="space-y-2">
                <Label htmlFor="share-search">Share with</Label>
                {picked.length > 0 && (
                  // gap-3 and py-1 leave room for each ✕'s 44px tap area, so
                  // it never lands on the next chip, the label or the search.
                  <div className="flex flex-wrap gap-3 py-1">
                    {picked.map((p) => (
                      <span
                        key={p.profileId}
                        className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      >
                        <span className="truncate" title={p.fullName}>
                          {p.fullName}
                        </span>
                        <button
                          type="button"
                          data-hit-area
                          aria-label={`Remove ${p.fullName}`}
                          onClick={() => unpick(p.profileId)}
                          className="relative rounded-full p-0.5 before:absolute before:-inset-[14px] hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="share-search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search people"
                    className="pl-8"
                    autoComplete="off"
                    disabled={picked.length >= MAX_RECIPIENTS}
                  />
                </div>
                <div className="max-h-44 overflow-y-auto rounded-md border">
                  {groups.length === 0 ? (
                    <p className="px-3 py-3 text-sm text-muted-foreground">
                      {people.length === 0 ? "No one to share with." : "No matches."}
                    </p>
                  ) : (
                    groups.map((g) => (
                      <div key={g.name}>
                        <div
                          title={g.name}
                          className="sticky top-0 truncate bg-muted px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                        >
                          {g.name}
                        </div>
                        {g.people.map((p) => (
                          <button
                            key={`${g.name}-${p.profileId}`}
                            type="button"
                            onClick={() => pick(p)}
                            title={p.jobTitle ? `${p.fullName}, ${p.jobTitle}` : p.fullName}
                            className="flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-muted"
                          >
                            {/* Both give way on a narrow screen; the job title
                                gives way first. */}
                            <span className="truncate">{p.fullName}</span>
                            {p.jobTitle && (
                              <span className="shrink-[3] truncate text-xs text-muted-foreground">{p.jobTitle}</span>
                            )}
                          </button>
                        ))}
                      </div>
                    ))
                  )}
                </div>
            </div>

              {/* Note */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <Label htmlFor="share-note">Note (optional)</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {note.length}/{NOTE_LIMIT}
                  </span>
                </div>
                <textarea
                  id="share-note"
                  value={note}
                  maxLength={NOTE_LIMIT}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What should they look at?"
                  className="flex min-h-[70px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              {/* One box, a block per person: a heading, then one line per
                  item, cut to the first few until Show all. */}
              {warnings.length > 0 && (
                <div className="space-y-3 rounded-md border border-[#fdba74] bg-[#fff7ed] px-3 py-2 text-sm text-[#7c2d12]">
                  {warnings.map(({ person, ids: blocked }) => {
                    const who = <strong className="font-semibold">{person.fullName}</strong>
                    if (items && blocked.length >= items.length) {
                      return (
                        <p key={person.profileId}>
                          {who} can&apos;t open any of these.
                        </p>
                      )
                    }
                    const blockedIds = new Set(blocked)
                    // In the dialog's own order, not the check's.
                    const lines = warningLines(type, (items ?? []).filter((i) => blockedIds.has(i.id)))
                    const long = lines.length > WARNING_LINES
                    const open = expanded.has(person.profileId)
                    const shown = long && !open ? lines.slice(0, WARNING_LINES) : lines
                    return (
                      <div key={person.profileId}>
                        <p>
                          {who} can&apos;t open {blocked.length} of these:
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {shown.map((line) => (
                            <li
                              key={line.id}
                              title={line.detail ? `${line.text} · ${line.detail}` : line.text}
                              className="truncate"
                            >
                              {line.text}
                              {line.detail && <span className="opacity-70"> · {line.detail}</span>}
                            </li>
                          ))}
                        </ul>
                        {long && (
                          <p className="mt-1">
                            {!open && `and ${lines.length - WARNING_LINES} more `}
                            {/* data-hit-area opts out of the global 44px mobile
                                touch-target rule, which would stretch this
                                line of text; the padding and matching negative
                                margin keep a tall tap area without it. */}
                            <button
                              type="button"
                              data-hit-area
                              aria-expanded={open}
                              onClick={() => toggleExpanded(person.profileId)}
                              className="-my-2 py-2 font-medium underline underline-offset-2 hover:text-[#431407]"
                            >
                              {open ? "Show less" : "Show all"}
                            </button>
                          </p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <DialogFooter className="shrink-0">
              <Button variant="outline" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={handleShare} disabled={!canShare}>
                {pending ? "Sharing…" : warnings.length > 0 ? "Share anyway" : "Share"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
