"use client"

import { useEffect, useState, useTransition } from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Combobox } from "@base-ui/react/combobox"
import { ChevronDown, Lock, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  createAction,
  listActionTargetPeriods,
  listActionTargets,
} from "@/features/action-items/mutations"
import { ACTION_PRIORITY_LABEL } from "@/features/action-items/labels"
import {
  ITEM_TYPE_LABEL,
  type ActionItemType,
  type ActionTarget,
  type ActionTargetPeriod,
} from "@/features/action-items/sources"
import type { ActionLinkSourceType } from "@/features/action-items/schema"

/** An item page's own record, when "New action" is opened from it. */
export type NewActionTarget = {
  type: Exclude<ActionItemType, "document">
  id: string
  /** The item's name, shown in the locked Related to field. */
  label: string
}

const TYPE_ORDER: ActionItemType[] = ["risk", "kpi", "objective", "document"]

// Base UI resolves a trigger's label from `items`; without it the trigger
// shows the raw value.
const NO_QUARTER = "none"
const NO_PRIORITY = "none"
const PRIORITY_ITEMS: Record<string, string> = { [NO_PRIORITY]: "None", ...ACTION_PRIORITY_LABEL }

/** What a quarter's row is called, per item type. */
const ROW_NOUN: Record<Exclude<ActionItemType, "document">, string> = {
  risk: "treatment review",
  kpi: "measurement",
  objective: "measurement",
}

/** The item in running text: "Links to the KPI itself." */
const ITEM_NOUN: Record<ActionItemType, { one: string; many: string }> = {
  risk: { one: "risk", many: "risks" },
  kpi: { one: "KPI", many: "KPIs" },
  objective: { one: "objective", many: "objectives" },
  document: { one: "document change", many: "document changes" },
}

const ITEM_SOURCE: Record<ActionItemType, ActionLinkSourceType> = {
  risk: "risk",
  kpi: "kpi",
  objective: "objective",
  document: "document_change",
}

const POPUP =
  "flex max-h-[min(var(--available-height),20rem)] w-(--anchor-width) max-w-[calc(100vw-1rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
const OPTION =
  "flex min-h-9 cursor-default flex-col justify-center rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-accent data-selected:font-semibold"
const EMPTY = "px-3 py-2.5 text-sm text-muted-foreground empty:hidden"

function periodText(p: ActionTargetPeriod) {
  const quarter = `${p.label} ${p.year}`
  return p.note ? `${quarter} · ${p.note}` : quarter
}

/**
 * The "New action" entrance. Every action is related to something: the
 * dialog's first field picks the risk, KPI, objective or document change,
 * and for the first three an optional quarter whose review or measurement
 * the action links to.
 *
 * On a risk/KPI/objective page, pass `target`: Related to is filled in
 * with that record and locked, and the quarter starts at the page's
 * ?year=&quarter=. No department is chosen anywhere — the server derives
 * it from the linked item.
 */
export default function NewActionButton({ target }: { target?: NewActionTarget }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button className="gap-2 h-9" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New action
      </Button>
      {open && <NewActionDialog target={target} onClose={() => setOpen(false)} />}
    </>
  )
}

function NewActionDialog({
  target,
  onClose,
}: {
  target?: NewActionTarget
  onClose: () => void
}) {
  const searchParams = useSearchParams()
  // The quarter an item page was showing; only read when opened from one.
  const urlYear = target ? searchParams.get("year") : null
  const urlQuarter = target ? searchParams.get("quarter") : null

  const [itemType, setItemType] = useState<ActionItemType | null>(target?.type ?? null)
  const [item, setItem] = useState<ActionTarget | null>(
    target ? { id: target.id, label: target.label, detail: null } : null
  )
  // Each list remembers what it was loaded for, so a stale one reads as
  // loading instead of showing the previous type's or item's rows.
  const [targets, setTargets] = useState<{ type: ActionItemType; list: ActionTarget[] } | null>(null)
  const [periods, setPeriods] = useState<{ itemId: string; list: ActionTargetPeriod[] } | null>(null)
  // null until the user picks one: the default follows the loaded list.
  const [periodChoice, setPeriodChoice] = useState<string | null>(null)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [ownerTitle, setOwnerTitle] = useState("")
  const [priority, setPriority] = useState(NO_PRIORITY)
  const [startDate, setStartDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [pending, startTransition] = useTransition()

  // The items of the chosen type, as the signed-in user can see them.
  // Not needed when locked to the page's record.
  useEffect(() => {
    if (target || !itemType) return
    let live = true
    void listActionTargets(itemType)
      .then((list) => live && setTargets({ type: itemType, list }))
      .catch(() => live && setTargets({ type: itemType, list: [] }))
    return () => {
      live = false
    }
  }, [target, itemType])

  // The quarters the chosen item has a row in.
  const itemId = item?.id ?? null
  useEffect(() => {
    if (!itemType || itemType === "document" || !itemId) return
    let live = true
    void listActionTargetPeriods(itemType, itemId)
      .then((list) => live && setPeriods({ itemId, list }))
      .catch(() => live && setPeriods({ itemId, list: [] }))
    return () => {
      live = false
    }
  }, [itemType, itemId])

  const targetList = targets && targets.type === itemType ? targets.list : null
  const needsQuarter = itemType !== null && itemType !== "document" && item !== null
  const periodList = needsQuarter && periods && periods.itemId === item.id ? periods.list : null

  // Opened from an item page: that page's quarter when it has a row, else
  // the item itself. Otherwise the latest quarter that has a row.
  const urlPeriod =
    urlYear && urlQuarter
      ? periodList?.find((p) => String(p.year) === urlYear && p.label === urlQuarter) ?? null
      : null
  const defaultChoice =
    urlYear && urlQuarter
      ? urlPeriod?.sourceId ?? NO_QUARTER
      : periodList?.[0]?.sourceId ?? NO_QUARTER
  const choice =
    periodChoice !== null && (periodChoice === NO_QUARTER || periodList?.some((p) => p.sourceId === periodChoice))
      ? periodChoice
      : defaultChoice
  const chosenPeriod = periodList?.find((p) => p.sourceId === choice) ?? null

  const quarterItems: Record<string, string> = {
    [NO_QUARTER]: "No quarter",
    ...Object.fromEntries((periodList ?? []).map((p) => [p.sourceId, periodText(p)])),
  }

  const changeType = (next: ActionItemType) => {
    if (next === itemType) return
    setItemType(next)
    setItem(null)
    setPeriodChoice(null)
  }
  const changeItem = (next: ActionTarget | null) => {
    setItem(next)
    setPeriodChoice(null)
  }

  const handleSave = () => {
    if (!itemType || !item) {
      toast.error("Choose what this action is related to.")
      return
    }
    if (needsQuarter && periodList === null) {
      toast.error("Quarters are still loading.")
      return
    }
    if (title.trim() === "") {
      toast.error("Title is required.")
      return
    }

    const link = chosenPeriod
      ? { sourceType: chosenPeriod.sourceType, sourceId: chosenPeriod.sourceId }
      : { sourceType: ITEM_SOURCE[itemType], sourceId: item.id }

    startTransition(async () => {
      const result = await createAction({
        ...link,
        title,
        description: description || undefined,
        ownerTitle: ownerTitle || undefined,
        priority: priority === NO_PRIORITY ? undefined : Number(priority),
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      })
      if (result.ok) {
        toast.success("Action created.")
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  let linkHint: string | null = null
  if (itemType && itemType !== "document" && item && periodList) {
    const noun = ROW_NOUN[itemType]
    const itemNoun = ITEM_NOUN[itemType].one
    if (chosenPeriod) {
      linkHint = `Links to the ${chosenPeriod.label} ${chosenPeriod.year} ${noun}.`
    } else if (urlYear && urlQuarter && periodChoice === null) {
      linkHint = `No ${noun} for ${urlQuarter} ${urlYear}. Links to the ${itemNoun} itself.`
    } else if (periodList.length === 0) {
      linkHint = `No quarter has a ${noun} yet. Links to the ${itemNoun} itself.`
    } else {
      linkHint = `Links to the ${itemNoun} itself.`
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold tracking-tight">New action</h2>

        {/* ── Related to ── */}
        <div className="space-y-2">
          <Label htmlFor={target ? undefined : "action-related-item"}>Related to</Label>
          {target ? (
            <div
              className="flex min-h-9 items-center gap-2 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-sm"
              title={`${ITEM_TYPE_LABEL[target.type]} · ${target.label}`}
            >
              <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="shrink-0 text-muted-foreground">{ITEM_TYPE_LABEL[target.type]}</span>
              <span className="truncate font-medium">{target.label}</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <Select
                items={ITEM_TYPE_LABEL}
                value={itemType}
                onValueChange={(v) => v && changeType(v as ActionItemType)}
                disabled={pending}
              >
                <SelectTrigger aria-label="Type" className="w-40 shrink-0 bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_ORDER.map((t) => (
                    <SelectItem key={t} value={t}>
                      {ITEM_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <ItemCombobox
                id="action-related-item"
                items={targetList}
                value={item}
                onChange={changeItem}
                disabled={pending || !itemType}
                placeholder={
                  !itemType
                    ? "Choose a type first"
                    : targetList === null
                      ? "Loading…"
                      : `Search ${ITEM_NOUN[itemType].many}…`
                }
              />
            </div>
          )}
        </div>

        {needsQuarter && (
          <div className="space-y-2">
            <Label htmlFor="action-quarter">Quarter</Label>
            <Select
              items={quarterItems}
              value={periodList === null ? null : choice}
              onValueChange={(v) => v && setPeriodChoice(v)}
              disabled={pending || periodList === null}
            >
              <SelectTrigger id="action-quarter" className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Loading…" className="min-w-0">
                  {(v: string) => <span className="truncate">{quarterItems[v] ?? v}</span>}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_QUARTER}>No quarter</SelectItem>
                {(periodList ?? []).map((p) => (
                  <SelectItem key={p.sourceId} value={p.sourceId}>
                    <span className="truncate" title={periodText(p)}>
                      {periodText(p)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {linkHint && <p className="text-xs text-muted-foreground">{linkHint}</p>}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="action-title">Title</Label>
          <Input
            id="action-title"
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to happen"
            className="bg-white dark:bg-slate-950"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="action-description">Description</Label>
          <textarea
            id="action-description"
            className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            value={description}
            disabled={pending}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="action-owner">Owner (job title)</Label>
            <Input
              id="action-owner"
              value={ownerTitle}
              disabled={pending}
              onChange={(e) => setOwnerTitle(e.target.value)}
              placeholder="e.g., IT Manager"
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-priority">Priority</Label>
            <Select
              items={PRIORITY_ITEMS}
              value={priority}
              onValueChange={(v) => v && setPriority(v)}
              disabled={pending}
            >
              <SelectTrigger id="action-priority" className="w-full bg-white dark:bg-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="action-start">Start date</Label>
            <Input
              id="action-start"
              type="date"
              value={startDate}
              disabled={pending}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-due">Due date</Label>
            <Input
              id="action-due"
              type="date"
              value={dueDate}
              disabled={pending}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t dark:border-slate-800">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || !item}>
            {pending ? "Creating…" : "Create action"}
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Searchable single pick over the loaded items; matches name and detail. */
function ItemCombobox({
  id,
  items,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  id: string
  /** null while loading. */
  items: ActionTarget[] | null
  value: ActionTarget | null
  onChange: (item: ActionTarget | null) => void
  disabled: boolean
  placeholder: string
}) {
  return (
    <Combobox.Root
      items={items ?? []}
      value={value}
      onValueChange={(v) => onChange(v)}
      itemToStringLabel={(t: ActionTarget) => t.label}
      isItemEqualToValue={(a: ActionTarget, b: ActionTarget) => a.id === b.id}
      filter={(t: ActionTarget, query: string) => {
        const q = query.trim().toLowerCase()
        return !q || `${t.label} ${t.detail ?? ""}`.toLowerCase().includes(q)
      }}
      disabled={disabled || items === null}
      autoHighlight
    >
      <div className="relative min-w-0 flex-1">
        <Combobox.Input
          id={id}
          placeholder={placeholder}
          title={value?.label}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-white py-1 pr-9 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm dark:bg-slate-950"
        />
        <Combobox.Trigger
          aria-label="Show items"
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </Combobox.Trigger>
      </div>

      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4} collisionPadding={8} className="isolate z-50">
          <Combobox.Popup className={POPUP}>
            <Combobox.Empty className={EMPTY}>
              {items && items.length === 0 ? "Nothing of this type that you can see." : "No match."}
            </Combobox.Empty>
            <Combobox.List className="min-h-0 overflow-y-auto p-1 empty:hidden">
              {(t: ActionTarget) => (
                <Combobox.Item key={t.id} value={t} className={OPTION}>
                  <span className="line-clamp-2">{t.label}</span>
                  {t.detail && <span className="text-xs font-normal text-muted-foreground">{t.detail}</span>}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
