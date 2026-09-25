"use client"

import { useId, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FilePlus2, GitBranch } from "lucide-react"
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
import { createChangeRequest } from "@/features/documents/mutations"
import type { DocumentListItem, DocumentTypeOption, RequestableDepartment } from "@/features/documents/queries"
import type { ChangeRequestInput } from "@/features/documents/schema"

export type DocumentOption = Pick<
  DocumentListItem,
  "id" | "name" | "currentRevision" | "departmentId" | "department" | "reviewerName" | "documentType"
>

type RequestType = NonNullable<ChangeRequestInput["requestType"]>

const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

const Req = () => <span className="text-rose-500">*</span>

const MAX_MATCHES = 8

const REQUEST_TYPE_LABEL: Record<RequestType, string> = {
  new: "New document",
  revision: "Revision",
  deletion: "Deletion",
}

/**
 * Read-only route of who decides this request, so the requester knows what
 * they are starting before they submit it. Phase 1 (permission) always
 * runs; a deletion skips phase 2 (the document) entirely and goes straight
 * from IMS approval to document control, since there is nothing to draft.
 */
function ReviewPhase({ title, steps, start }: { title: string; steps: string[]; start: number }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">{title}</p>
      <ol className="space-y-0.5 text-sm">
        {steps.map((step, i) => (
          <li key={step} className="flex items-baseline gap-1.5">
            <span className="text-xs text-muted-foreground tabular-nums shrink-0">{start + i}.</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function WhoWillReview({ requestType, reviewerName }: { requestType: RequestType; reviewerName: string | null }) {
  const phase1 = [reviewerName ?? "Department Head", "QMS or ISMS Coordinator", "IMS Manager"]
  const isDeletion = requestType === "deletion"

  return (
    <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 p-3">
      <p className="text-xs font-semibold text-muted-foreground">Who will review this</p>
      <ReviewPhase title="Phase 1 — permission" steps={phase1} start={1} />
      {isDeletion ? (
        <div className="space-y-1.5">
          <ReviewPhase title="Then" steps={["Document control retires the document"]} start={4} />
          <p className="text-xs text-muted-foreground">
            A deletion skips phase 2 — there is no document to draft or approve, only the retirement to record.
          </p>
        </div>
      ) : (
        <ReviewPhase
          title="Phase 2 — the document"
          steps={["QMS or ISMS Coordinator (draft check)", "IMS Manager", "CTO/VP", "Document control"]}
          start={4}
        />
      )}
    </div>
  )
}

/**
 * Raises a change request. requestType decides the shape: New names a
 * document the system does not hold yet; Revision and Deletion both name an
 * existing one, picked from a search. Opened from a document's own page,
 * only Revision and Deletion are offered — the document is already fixed,
 * so New makes no sense there.
 */
export default function ChangeRequestDialog({
  documents,
  departments,
  documentTypes,
  defaultDepartmentId,
  fixedDocument,
  onClose,
}: {
  documents: DocumentOption[]
  departments: RequestableDepartment[]
  documentTypes: DocumentTypeOption[]
  defaultDepartmentId: string | null
  /** Opened from a document's own page: that document, not changeable. */
  fixedDocument?: DocumentOption
  onClose: () => void
}) {
  const router = useRouter()
  const listId = useId()

  const availableTypes: RequestType[] = fixedDocument ? ["revision", "deletion"] : ["new", "revision", "deletion"]
  const [requestType, setRequestType] = useState<RequestType>("revision")

  const [query, setQuery] = useState(fixedDocument?.name ?? "")
  const [selected, setSelected] = useState<DocumentOption | null>(fixedDocument ?? null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [documentName, setDocumentName] = useState("")
  const [departmentId, setDepartmentId] = useState(defaultDepartmentId ?? "")
  const [documentType, setDocumentType] = useState("")
  const [documentNumber, setDocumentNumber] = useState("")
  const [storageUrl, setStorageUrl] = useState("")
  const [supportingFileUrl, setSupportingFileUrl] = useState("")
  const [proposedRevision, setProposedRevision] = useState("")
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [affected, setAffected] = useState("")
  const [iso, setIso] = useState("")
  const [effective, setEffective] = useState("")
  const [pending, startTransition] = useTransition()

  const isNew = requestType === "new"
  const isDeletion = requestType === "deletion"

  const trimmed = query.trim()
  const matches = useMemo(() => {
    const q = trimmed.toLowerCase()
    return documents.filter((d) => q === "" || d.name.toLowerCase().includes(q)).slice(0, MAX_MATCHES)
  }, [documents, trimmed])

  const departmentOfSelected = selected
    ? departments.find((d) => d.id === selected.departmentId)?.name ?? selected.department?.name ?? selected.department?.code ?? null
    : null
  const reviewerName = isNew
    ? departments.find((d) => d.id === departmentId)?.managerName ?? null
    : selected?.reviewerName ?? null
  const selectedTypeName = selected?.documentType
    ? documentTypes.find((t) => t.key === selected.documentType)?.name ?? selected.documentType
    : null

  const chooseType = (t: RequestType) => {
    setRequestType(t)
    if (t === "new" && !fixedDocument) {
      setSelected(null)
      setQuery("")
    }
  }

  const pick = (d: DocumentOption) => {
    setSelected(d)
    setQuery(d.name)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true)
      return
    }
    if (!open) return
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, matches.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (matches[active]) pick(matches[active])
    } else if (e.key === "Escape") {
      setOpen(false)
    }
  }

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createChangeRequest({
        requestType,
        documentId: isNew ? "" : selected?.id ?? "",
        documentName: isNew ? documentName : undefined,
        departmentId: isNew ? departmentId : selected?.departmentId,
        documentNumber: isNew ? documentNumber : undefined,
        documentType: isNew ? documentType : undefined,
        storageUrl: isNew ? storageUrl : undefined,
        supportingFileUrl,
        proposedRevision: isDeletion ? undefined : proposedRevision,
        reasonForChange: reason,
        descriptionOfChange: description,
        affectedProcesses: affected,
        relatedIsoRequirements: iso,
        proposedEffectiveDate: effective,
      })
      if (result.ok) {
        const name = isNew ? documentName : selected?.name ?? ""
        toast.success(
          isNew
            ? `"${name}" added and its change request sent for review.`
            : `${REQUEST_TYPE_LABEL[requestType]} request for "${name}" sent for review.`
        )
        onClose()
        if (isNew) router.push(`/department/documents/${result.documentId}`)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 mt-0.5">
            <GitBranch className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Request a change</h2>
            <p className="text-sm text-muted-foreground">
              {fixedDocument
                ? <span className="truncate block" title={fixedDocument.name}>{fixedDocument.name}</span>
                : "Pick a document, or name one the system does not hold yet."}
            </p>
          </div>
        </div>

        {/* ── Request type ── */}
        <div className="space-y-2">
          <Label>Request type <Req /></Label>
          <div className="flex gap-2">
            {availableTypes.map((t) => (
              <button
                key={t}
                type="button"
                disabled={pending}
                onClick={() => chooseType(t)}
                className={`px-3 py-1.5 rounded-md border text-sm font-medium transition-colors disabled:opacity-50 ${
                  requestType === t
                    ? "bg-ink text-white border-ink"
                    : "bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-muted-foreground hover:text-ink"
                }`}
              >
                {REQUEST_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Document ── */}
        {isNew ? (
          <div className="space-y-2">
            <Label htmlFor="cr-document">Document name <Req /></Label>
            <Input
              id="cr-document"
              value={documentName}
              disabled={pending}
              placeholder="Name of the new document"
              onChange={(e) => setDocumentName(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <FilePlus2 className="h-3.5 w-3.5 text-blue-600" />
              It will be added to the register when this request is submitted.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="cr-document">Document <Req /></Label>
            <div className="relative">
              <Input
                id="cr-document"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                autoComplete="off"
                value={query}
                disabled={pending || !!fixedDocument}
                placeholder="Start typing a document name…"
                className="bg-white dark:bg-slate-950"
                onChange={(e) => {
                  setQuery(e.target.value)
                  setSelected(null)
                  setActive(0)
                  setOpen(true)
                }}
                onFocus={() => {
                  if (blurTimer.current) clearTimeout(blurTimer.current)
                  if (!fixedDocument) setOpen(true)
                }}
                // Delayed so a click on a row registers before the list unmounts.
                onBlur={() => {
                  blurTimer.current = setTimeout(() => setOpen(false), 150)
                }}
                onKeyDown={onKeyDown}
              />
              {open && matches.length > 0 && (
                <ul
                  id={listId}
                  role="listbox"
                  className="absolute z-10 mt-1 w-full max-h-64 overflow-y-auto rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-md py-1 text-sm"
                >
                  {matches.map((d, i) => (
                    <li
                      key={d.id}
                      role="option"
                      aria-selected={i === active}
                      className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-3 ${i === active ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                      onMouseEnter={() => setActive(i)}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(d)}
                    >
                      <span className="truncate">{d.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground font-mono">
                        {d.department?.code ?? "—"} · {d.currentRevision ?? "no rev"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ── Department: drives review routing ── */}
        <div className="space-y-2">
          <Label htmlFor="cr-department">Department <Req /></Label>
          {isNew ? (
            departments.length === 0 ? (
              <p className="text-sm text-muted-foreground">You are not a member of any department, so you cannot add a document.</p>
            ) : (
              <Select
                value={departmentId}
                onValueChange={(v) => v && setDepartmentId(v)}
                disabled={pending}
                items={departments.map((d) => ({ value: d.id, label: d.name }))}
              >
                <SelectTrigger id="cr-department" className="w-full bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )
          ) : (
            <Input id="cr-department" value={departmentOfSelected ?? ""} readOnly disabled className="bg-slate-50 dark:bg-slate-900" />
          )}
          <p className="text-xs text-muted-foreground">The department&rsquo;s manager reviews the request first.</p>
        </div>

        {/* ── Document type: editable for a new document, read-only otherwise ── */}
        <div className="space-y-2">
          <Label htmlFor="cr-doctype">Document type</Label>
          {isNew ? (
            <Select
              value={documentType}
              onValueChange={(v) => v && setDocumentType(v)}
              disabled={pending}
              items={documentTypes.map((t) => ({ value: t.key, label: t.name }))}
            >
              <SelectTrigger id="cr-doctype" className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Select a type" />
              </SelectTrigger>
              <SelectContent>
                {documentTypes.map((t) => (
                  <SelectItem key={t.key} value={t.key}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input id="cr-doctype" value={selectedTypeName ?? "—"} readOnly disabled className="bg-slate-50 dark:bg-slate-900" />
          )}
        </div>

        {/* ── New document only ── */}
        {isNew && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cr-number">Document number</Label>
              <Input id="cr-number" value={documentNumber} disabled={pending} placeholder="e.g., IT-PR-04" onChange={(e) => setDocumentNumber(e.target.value)} className="bg-white dark:bg-slate-950" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cr-url">Where it lives</Label>
              <Input id="cr-url" type="url" value={storageUrl} disabled={pending} placeholder="OneDrive / SharePoint link" onChange={(e) => setStorageUrl(e.target.value)} className="bg-white dark:bg-slate-950" />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="cr-supporting">Supporting file link</Label>
          <Input id="cr-supporting" type="url" value={supportingFileUrl} disabled={pending} placeholder="Optional — background for the reviewers" onChange={(e) => setSupportingFileUrl(e.target.value)} className="bg-white dark:bg-slate-950" />
        </div>

        {!isDeletion && (
          <div className="space-y-2">
            <Label htmlFor="cr-revision">Proposed revision <Req /></Label>
            <Input id="cr-revision" value={proposedRevision} disabled={pending} placeholder="e.g., Rev 2" onChange={(e) => setProposedRevision(e.target.value)} className="bg-white dark:bg-slate-950" />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="cr-reason">Reason for change <Req /></Label>
          <textarea id="cr-reason" className={textareaClass} value={reason} disabled={pending} placeholder="Why the document needs to change…" onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cr-description">Description of change <Req /></Label>
          <textarea id="cr-description" className={textareaClass} value={description} disabled={pending} placeholder="What will be different…" onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cr-affected">Affected processes</Label>
            <Input id="cr-affected" value={affected} disabled={pending} onChange={(e) => setAffected(e.target.value)} className="bg-white dark:bg-slate-950" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cr-iso">Related ISO requirements</Label>
            <Input id="cr-iso" value={iso} disabled={pending} placeholder="e.g., 7.5.3" onChange={(e) => setIso(e.target.value)} className="bg-white dark:bg-slate-950" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cr-effective">Proposed effective date</Label>
          <Input id="cr-effective" type="date" value={effective} disabled={pending} onChange={(e) => setEffective(e.target.value)} className="bg-white dark:bg-slate-950 w-fit" />
        </div>

        <WhoWillReview requestType={requestType} reviewerName={reviewerName} />

        <div className="flex items-center justify-end gap-3 pt-2 border-t dark:border-slate-800">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={pending}>
            {pending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      </div>
    </div>
  )
}
