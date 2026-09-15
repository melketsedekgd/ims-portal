import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import type { Enums } from "@/types/database";

export type ChangeRequestStatus = Enums<"change_request_status">;
export type ApprovalStage = Enums<"approval_stage">;
export type ApprovalDecision = Enums<"approval_decision">;

// ── Register ────────────────────────────────────────────────────────────────

export type DocumentListItem = {
  id: string;
  name: string;
  documentNumber: string | null;
  /** null until the first approved change request publishes one. */
  currentRevision: string | null;
  ownerName: string | null;
  departmentId: string;
  department: { code: string; name: string } | null;
  processName: string | null;
  status: Enums<"document_status">;
};

type DocumentRow = {
  id: string;
  name: string;
  document_number: string | null;
  current_revision: string | null;
  status: Enums<"document_status">;
  department_id: string;
  departments: { code: string; name: string } | null;
  processes: { name: string } | null;
  owner: { full_name: string } | null;
};

const DOCUMENT_SELECT = `id,
  name,
  document_number,
  current_revision,
  status,
  department_id,
  departments ( code, name ),
  processes ( name ),
  owner:profiles!documents_owner_id_fkey ( full_name )`;

function toListItem(d: DocumentRow): DocumentListItem {
  return {
    id: d.id,
    name: d.name,
    documentNumber: d.document_number,
    currentRevision: d.current_revision,
    ownerName: d.owner?.full_name ?? null,
    departmentId: d.department_id,
    department: d.departments,
    processName: d.processes?.name ?? null,
    status: d.status,
  };
}

/** Every controlled document. documents_select is organisation-wide. */
export async function getDocuments(): Promise<DocumentListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .order("name")
    .returns<DocumentRow[]>();
  if (error) throw error;
  return (data ?? []).map(toListItem);
}

export type RequestableDepartment = { id: string; name: string; code: string };

/**
 * Departments a new document can be filed under: every active one for an
 * IMS admin, otherwise the departments the caller belongs to — mirroring
 * documents_insert. A user with none gets an empty list and the form
 * says so rather than offering a select that can only fail.
 */
export async function getRequestableDepartments(): Promise<RequestableDepartment[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const isAdmin = user.roles.some(
    (r) => r.key === "system_admin" || r.key === "ims_admin"
  );

  if (isAdmin) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, code")
      .eq("status", "active")
      .order("name");
    if (error) throw error;
    return data ?? [];
  }

  // Any role carries its department on the user_roles row; dedupe in case
  // the same department is granted twice.
  const seen = new Map<string, RequestableDepartment>();
  for (const r of user.roles) {
    if (r.departmentId && !seen.has(r.departmentId)) {
      seen.set(r.departmentId, {
        id: r.departmentId,
        name: r.departmentName ?? r.departmentCode ?? "",
        code: r.departmentCode ?? "",
      });
    }
  }
  return [...seen.values()];
}

// ── Change requests ─────────────────────────────────────────────────────────

export type ApprovalItem = {
  id: string;
  stage: ApprovalStage;
  decision: ApprovalDecision;
  decidedBy: string | null;
  decidedAt: string;
  reason: string | null;
};

export type ChangeRequestItem = {
  id: string;
  documentId: string;
  documentName: string;
  requesterId: string;
  requesterName: string | null;
  proposedRevision: string;
  reasonForChange: string;
  descriptionOfChange: string;
  affectedProcesses: string | null;
  relatedIsoRequirements: string | null;
  proposedEffectiveDate: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
  updatedAt: string;
  /** Oldest first — the order decisions were taken. */
  approvals: ApprovalItem[];
};

type ChangeRequestRow = {
  id: string;
  document_id: string;
  requester_id: string;
  proposed_revision: string;
  reason_for_change: string;
  description_of_change: string;
  affected_processes: string | null;
  related_iso_requirements: string | null;
  proposed_effective_date: string | null;
  status: ChangeRequestStatus;
  created_at: string;
  updated_at: string;
  documents: { name: string } | null;
  requester: { full_name: string } | null;
  document_change_approvals: {
    id: string;
    stage: ApprovalStage;
    decision: ApprovalDecision;
    decided_at: string;
    reason: string | null;
    decider: { full_name: string } | null;
  }[];
};

const CHANGE_REQUEST_SELECT = `id,
  document_id,
  requester_id,
  proposed_revision,
  reason_for_change,
  description_of_change,
  affected_processes,
  related_iso_requirements,
  proposed_effective_date,
  status,
  created_at,
  updated_at,
  documents ( name ),
  requester:profiles!document_change_requests_requester_id_fkey ( full_name ),
  document_change_approvals (
    id,
    stage,
    decision,
    decided_at,
    reason,
    decider:profiles!document_change_approvals_decided_by_fkey ( full_name )
  )`;

function toChangeRequest(r: ChangeRequestRow): ChangeRequestItem {
  return {
    id: r.id,
    documentId: r.document_id,
    documentName: r.documents?.name ?? "",
    requesterId: r.requester_id,
    requesterName: r.requester?.full_name ?? null,
    proposedRevision: r.proposed_revision,
    reasonForChange: r.reason_for_change,
    descriptionOfChange: r.description_of_change,
    affectedProcesses: r.affected_processes,
    relatedIsoRequirements: r.related_iso_requirements,
    proposedEffectiveDate: r.proposed_effective_date,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    approvals: [...r.document_change_approvals]
      .sort((a, b) => a.decided_at.localeCompare(b.decided_at))
      .map((a) => ({
        id: a.id,
        stage: a.stage,
        decision: a.decision,
        decidedBy: a.decider?.full_name ?? null,
        decidedAt: a.decided_at,
        reason: a.reason,
      })),
  };
}

// ── Document detail ─────────────────────────────────────────────────────────

export type RevisionItem = {
  id: string;
  revisionLabel: string;
  changeRequestId: string | null;
  publishedBy: string | null;
  publishedAt: string;
};

export type DocumentDetail = DocumentListItem & {
  /** Newest first. Only the requests RLS lets this user see. */
  changeRequests: ChangeRequestItem[];
  /** Newest first. */
  revisions: RevisionItem[];
};

type RevisionRow = {
  id: string;
  revision_label: string;
  change_request_id: string | null;
  published_at: string;
  publisher: { full_name: string } | null;
};

/**
 * One document with its change-request and revision histories.
 *
 * Three queries rather than one nested select: requests and revisions have
 * their own RLS (a requester sees only their own requests; revisions are
 * public), and keeping them separate means a document with nothing the
 * user may see still renders its definition. null means no such id — and
 * only that, since documents_select is `true` for every signed-in user.
 */
export async function getDocumentWithHistory(id: string): Promise<DocumentDetail | null> {
  const supabase = await createClient();

  const { data: doc, error } = await supabase
    .from("documents")
    .select(DOCUMENT_SELECT)
    .eq("id", id)
    .maybeSingle()
    .returns<DocumentRow | null>();
  if (error?.code === "22P02") return null; // not a uuid
  if (error) throw error;
  if (!doc) return null;

  const [requests, revisions] = await Promise.all([
    supabase
      .from("document_change_requests")
      .select(CHANGE_REQUEST_SELECT)
      .eq("document_id", id)
      .returns<ChangeRequestRow[]>(),
    supabase
      .from("document_revisions")
      .select(
        `id,
         revision_label,
         change_request_id,
         published_at,
         publisher:profiles!document_revisions_published_by_fkey ( full_name )`
      )
      .eq("document_id", id)
      .returns<RevisionRow[]>(),
  ]);
  if (requests.error) throw requests.error;
  if (revisions.error) throw revisions.error;

  return {
    ...toListItem(doc),
    changeRequests: (requests.data ?? [])
      .map(toChangeRequest)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    revisions: (revisions.data ?? [])
      .map((r) => ({
        id: r.id,
        revisionLabel: r.revision_label,
        changeRequestId: r.change_request_id,
        publishedBy: r.publisher?.full_name ?? null,
        publishedAt: r.published_at,
      }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)),
  };
}

// ── Approval queues ─────────────────────────────────────────────────────────

export type ApprovalQueues = {
  /** Requests at pending_owner on documents this user reviews. */
  owner: ChangeRequestItem[];
  /** Requests at pending_ims. null when the user is not an IMS admin — the queue does not exist for them, which is different from being empty. */
  ims: ChangeRequestItem[] | null;
};

/**
 * The review queues that apply to the signed-in user.
 *
 * DELIBERATE ACTORSHIP FILTER. RLS does not scope this: a requester can
 * read their own request at pending_owner, so a status-only filter would
 * put their own submission in their "awaiting my review" queue. The owner
 * queue is restricted to documents this user reviews — the same rule as
 * can_review_document(): the named owner, or the department's manager
 * when no owner is set — and the IMS queue exists only for holders of an
 * IMS-admin role, mirroring the insert policy on
 * document_change_approvals, so what is listed is what the user can
 * actually decide. Do not remove these filters.
 */
export async function getApprovalQueues(): Promise<ApprovalQueues> {
  const user = await getCurrentUser();
  if (!user) return { owner: [], ims: null };

  const supabase = await createClient();

  const managed = new Set(
    user.roles.filter((r) => r.key === "department_manager" && r.departmentId).map((r) => r.departmentId)
  );
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id, owner_id, department_id");
  if (docsError) throw docsError;
  const ownedIds = (docs ?? [])
    .filter((d) => d.owner_id === user.id || (d.owner_id === null && managed.has(d.department_id)))
    .map((d) => d.id);

  const isImsAdmin = user.roles.some(
    (r) => r.key === "system_admin" || r.key === "ims_admin"
  );

  const [ownerQ, imsQ] = await Promise.all([
    ownedIds.length === 0
      ? Promise.resolve({ data: [] as ChangeRequestRow[], error: null })
      : supabase
          .from("document_change_requests")
          .select(CHANGE_REQUEST_SELECT)
          .eq("status", "pending_owner")
          .in("document_id", ownedIds)
          .order("created_at")
          .returns<ChangeRequestRow[]>(),
    isImsAdmin
      ? supabase
          .from("document_change_requests")
          .select(CHANGE_REQUEST_SELECT)
          .eq("status", "pending_ims")
          .order("created_at")
          .returns<ChangeRequestRow[]>()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (ownerQ.error) throw ownerQ.error;
  if (imsQ.error) throw imsQ.error;

  return {
    owner: (ownerQ.data ?? []).map(toChangeRequest),
    ims: isImsAdmin ? (imsQ.data ?? []).map(toChangeRequest) : null,
  };
}
