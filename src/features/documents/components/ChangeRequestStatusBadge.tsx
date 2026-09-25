import { Badge } from "@/components/ui/badge"
import type { ChangeRequestStatus, ApprovalDecision, ApprovalStage } from "@/features/documents/queries"
import type { Enums } from "@/types/database"

export const REQUEST_TYPE_LABEL: Record<Enums<"document_request_type">, string> = {
  new: "New document",
  revision: "Revision",
  deletion: "Deletion",
}

/**
 * Which phase a status belongs to, for a stage pill's phase note. null for
 * a finished or not-yet-submitted status — there is no phase left to name.
 */
export const STATUS_PHASE: Record<ChangeRequestStatus, 1 | 2 | null> = {
  draft: null,
  pending_owner: 1,
  pending_coordinator: 1,
  pending_ims: 1,
  rejected: 1,
  awaiting_draft: 2,
  pending_draft_check: 2,
  draft_returned: 2,
  pending_ims_document: 2,
  pending_final: 2,
  pending_document_control: 2,
  published: null,
  retired: null,
}

/** The stage each open status is waiting on, in the order a request moves through them. */
export const STATUS_STAGE: Partial<Record<ChangeRequestStatus, ApprovalStage>> = {
  pending_owner: "owner",
  pending_coordinator: "coordinator_review",
  pending_ims: "ims",
  pending_draft_check: "draft_check",
  pending_ims_document: "ims_document",
  pending_final: "final",
  pending_document_control: "document_control",
}

export const STAGE_ORDER = Object.values(STATUS_STAGE).filter((s) => s !== undefined)

/** owner/coordinator_review/ims decide phase 1 (permission); everything else, including a draft, is phase 2 (the document). */
export const PHASE1_STAGES = new Set<ApprovalStage>(["owner", "coordinator_review", "ims"])

const AMBER ="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 border-transparent"
const BLUE = "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-transparent"
const ROSE = "bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400 border-transparent"
const EMERALD = "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 border-transparent"
const MUTED = "text-muted-foreground border-dashed"

// Phase 1 (permission) is amber, phase 2 (the document) is blue, a return
// is rose, and the two finished states get their own colour each.
const STATUS: Record<ChangeRequestStatus, { label: string; className: string }> = {
  draft:                    { label: "Draft",                       className: MUTED },
  pending_owner:            { label: "Waiting: owner review",       className: AMBER },
  pending_coordinator:      { label: "Waiting: QMS/ISMS review",    className: AMBER },
  pending_ims:              { label: "Waiting: IMS review",         className: AMBER },
  awaiting_draft:           { label: "Approved: waiting for draft", className: BLUE },
  pending_draft_check:      { label: "Waiting: draft review",       className: BLUE },
  draft_returned:           { label: "Draft returned",              className: ROSE },
  pending_ims_document:     { label: "Waiting: IMS review",         className: BLUE },
  pending_final:            { label: "Waiting: CTO/VP",             className: BLUE },
  pending_document_control: { label: "Waiting: document control",  className: BLUE },
  published:                { label: "Published",                  className: EMERALD },
  retired:                  { label: "Retired",                    className: MUTED },
  rejected:                 { label: "Returned",                   className: ROSE },
}

export function ChangeRequestStatusBadge({ status }: { status: ChangeRequestStatus }) {
  const s = STATUS[status]
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>
}

export const STAGE_LABEL: Record<ApprovalStage, string> = {
  owner: "Document owner",
  ims: "IMS Manager",
  coordinator_review: "QMS/ISMS Coordinator",
  draft_check: "QMS/ISMS Coordinator",
  ims_document: "IMS Manager",
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
