import { Badge } from "@/components/ui/badge"
import type { ChangeRequestStatus, ApprovalDecision, ApprovalStage } from "@/features/documents/queries"

const STATUS: Record<ChangeRequestStatus, { label: string; className: string }> = {
  draft:         { label: "Draft",          className: "text-muted-foreground border-dashed" },
  pending_owner: { label: "Awaiting owner", className: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 border-transparent" },
  pending_ims:   { label: "Awaiting IMS",   className: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-transparent" },
  pending_coordinator:      { label: "Awaiting coordinator",      className: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 border-transparent" },
  awaiting_draft:           { label: "Awaiting draft",            className: "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 border-transparent" },
  pending_draft_check:      { label: "Draft under review",        className: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-transparent" },
  draft_returned:           { label: "Draft returned",            className: "bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400 border-transparent" },
  pending_ims_document:     { label: "Awaiting IMS",               className: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-transparent" },
  pending_final:            { label: "Awaiting CTO/VP",            className: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-transparent" },
  pending_document_control: { label: "Awaiting document control", className: "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-transparent" },
  published:                { label: "Published",                 className: "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 border-transparent" },
  retired:                  { label: "Retired",                   className: "text-muted-foreground border-dashed" },
  rejected:                 { label: "Rejected",                  className: "bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400 border-transparent" },
}

export function ChangeRequestStatusBadge({ status }: { status: ChangeRequestStatus }) {
  const s = STATUS[status]
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>
}

export const STAGE_LABEL: Record<ApprovalStage, string> = {
  owner: "Document owner",
  ims: "IMS",
  coordinator_review: "QMS/ISMS Coordinator",
  draft_check: "QMS/ISMS Coordinator",
  ims_document: "IMS",
  final: "CTO/VP",
  document_control: "Document control",
}

export function DecisionBadge({ decision }: { decision: ApprovalDecision }) {
  return decision === "approved"
    ? <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Approved</Badge>
    : <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Rejected</Badge>
}

// Fixed locale and zone: rendered on the server, and a record date should
// not move with whichever machine renders it.
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  })
export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" })
