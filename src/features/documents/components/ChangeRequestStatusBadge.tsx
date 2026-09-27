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
  pending_extra_review: 1,
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
  pending_extra_review: "extra_review",
  pending_ims: "ims",
  pending_draft_check: "draft_check",
  pending_ims_document: "ims_document",
  pending_final: "final",
  pending_document_control: "document_control",
}

export const STAGE_ORDER = Object.values(STATUS_STAGE).filter((s) => s !== undefined)

/** owner/coordinator_review/extra_review/ims decide phase 1 (permission); everything else, including a draft, is phase 2 (the document). */
export const PHASE1_STAGES = new Set<ApprovalStage>(["owner", "coordinator_review", "extra_review", "ims"])

const AMBER ="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400 border-transparent"
const BLUE = "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 border-transparent"
const ROSE = "bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400 border-transparent"
const EMERALD = "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400 border-transparent"
const MUTED = "text-muted-foreground border-dashed"

export const STATUS_LABEL: Record<ChangeRequestStatus, string> = {
  draft: "Draft",
  pending_owner: "Waiting: owner review",
  pending_coordinator: "Waiting: QMS/ISMS review",
  pending_extra_review: "Waiting for other departments",
  pending_ims: "Waiting: IMS review",
  awaiting_draft: "Approved: waiting for draft",
  pending_draft_check: "Waiting: draft review",
  draft_returned: "Draft returned",
  pending_ims_document: "Waiting: IMS review",
  pending_final: "Waiting: CTO/VP",
  pending_document_control: "Waiting: document control",
  published: "Published",
  retired: "Retired",
  rejected: "Returned",
}

// Phase 1 (permission) is amber, phase 2 (the document) is blue, a return
// is rose, and the two finished states get their own colour each.
const STATUS: Record<ChangeRequestStatus, { label: string; className: string }> = {
  draft:                    { label: STATUS_LABEL.draft,                    className: MUTED },
  pending_owner:            { label: STATUS_LABEL.pending_owner,            className: AMBER },
  pending_coordinator:      { label: STATUS_LABEL.pending_coordinator,      className: AMBER },
  pending_extra_review:     { label: STATUS_LABEL.pending_extra_review,     className: AMBER },
  pending_ims:              { label: STATUS_LABEL.pending_ims,              className: AMBER },
  awaiting_draft:           { label: STATUS_LABEL.awaiting_draft,           className: BLUE },
  pending_draft_check:      { label: STATUS_LABEL.pending_draft_check,      className: BLUE },
  draft_returned:           { label: STATUS_LABEL.draft_returned,           className: ROSE },
  pending_ims_document:     { label: STATUS_LABEL.pending_ims_document,     className: BLUE },
  pending_final:            { label: STATUS_LABEL.pending_final,            className: BLUE },
  pending_document_control: { label: STATUS_LABEL.pending_document_control, className: BLUE },
  published:                { label: STATUS_LABEL.published,                className: EMERALD },
  retired:                  { label: STATUS_LABEL.retired,                  className: MUTED },
  rejected:                 { label: STATUS_LABEL.rejected,                 className: ROSE },
}

export function ChangeRequestStatusBadge({ status }: { status: ChangeRequestStatus }) {
  const s = STATUS[status]
  return <Badge variant="outline" className={s.className}>{s.label}</Badge>
}

export const STAGE_LABEL: Record<ApprovalStage, string> = {
  owner: "Document owner",
  ims: "IMS Manager",
  coordinator_review: "QMS/ISMS Coordinator",
  extra_review: "Other departments",
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
