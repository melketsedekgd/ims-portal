import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin, isDocCoordinator, isExecutiveApprover } from "@/lib/permissions";
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
  /** Where the document lives (OneDrive / SharePoint). */
  storageUrl: string | null;
  /**
   * Who reviews a change at the owner stage: the named owner when one is
   * set, otherwise the department's manager — the same rule as
   * can_review_document(). null when the department has no manager.
   */
  reviewerName: string | null;
  /** The document_types key, or null for a document filed before types existed. */
  documentType: string | null;
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
  storage_url: string | null;
  document_type: string | null;
  status: Enums<"document_status">;
  department_id: string;
  departments: {
    code: string;
    name: string;
    user_roles: { roles: { key: string } | null; profiles: { full_name: string } | null }[];
  } | null;
  processes: { name: string } | null;
  owner: { full_name: string } | null;
};

const DOCUMENT_SELECT = `id,
  name,
  document_number,
  current_revision,
  storage_url,
  document_type,
  status,
  department_id,
  departments (
    code,
    name,
    user_roles ( roles ( key ), profiles ( full_name ) )
  ),
  processes ( name ),
  owner:profiles!documents_owner_id_fkey ( full_name )`;

function toListItem(d: DocumentRow): DocumentListItem {
  const manager = d.departments?.user_roles.find((ur) => ur.roles?.key === "department_manager");
  return {
    id: d.id,
    name: d.name,
    documentNumber: d.document_number,
    currentRevision: d.current_revision,
    storageUrl: d.storage_url,
    reviewerName: d.owner?.full_name ?? manager?.profiles?.full_name ?? null,
    documentType: d.document_type,
    departmentId: d.department_id,
    department: d.departments ? { code: d.departments.code, name: d.departments.name } : null,
    processName: d.processes?.name ?? null,
    status: d.status,
  };
}

export type DocumentTypeOption = { key: string; name: string };

/** Document types for the request form's type select, in the order they're managed. */
export async function getDocumentTypes(): Promise<DocumentTypeOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_types")
    .select("key, name")
    .order("display_order");
  if (error) throw error;
  return data ?? [];
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

export type RequestableDepartment = {
  id: string;
  name: string;
  code: string;
  /** The department_manager who reviews phase 1 first, for "who will review this". */
  managerName: string | null;
};

/**
 * The active department_manager's name per department, for the request
 * form's review-route panel: a new document has no owner yet, so its phase-1
 * reviewer is named from here rather than from a document row.
 */
async function departmentManagerNames(): Promise<Record<string, string>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_roles")
    .select("department_id, roles!inner(key), profiles!inner(full_name, status)")
    .eq("roles.key", "department_manager")
    .eq("profiles.status", "active")
    .not("department_id", "is", null)
    .returns<{ department_id: string; profiles: { full_name: string } }[]>();
  if (error) throw error;
  const names: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!names[row.department_id]) names[row.department_id] = row.profiles.full_name;
  }
  return names;
}

/**
 * Departments a new document can be filed under: every active one for an
 * IMS admin, otherwise the departments the caller belongs to — mirroring
 * documents_insert. A user with none gets an empty list and the form
 * says so rather than offering a select that can only fail.
 */
export async function getRequestableDepartments(): Promise<RequestableDepartment[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  const managers = await departmentManagerNames();

  if (isAdmin(user)) {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, code")
      .eq("status", "active")
      .order("name");
    if (error) throw error;
    return (data ?? []).map((d) => ({ ...d, managerName: managers[d.id] ?? null }));
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
        managerName: managers[r.departmentId] ?? null,
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
  requestType: Enums<"document_request_type">;
  departmentCode: string | null;
  departmentName: string | null;
  processName: string | null;
  requesterId: string;
  requesterName: string | null;
  proposedRevision: string | null;
  reasonForChange: string;
  descriptionOfChange: string;
  affectedProcesses: string | null;
  relatedIsoRequirements: string | null;
  proposedEffectiveDate: string | null;
  supportingFileUrl: string | null;
  status: ChangeRequestStatus;
  createdAt: string;
  updatedAt: string;
  /**
   * Set when the owner stage is decided by IMS because the document has no
   * owner and its department has no manager — the third arm of
   * can_review_document(). Carries the department code for the label, so
   * the record explains why IMS appears at both stages.
   */
  reviewFallback: { departmentCode: string } | null;
  /** Oldest first — the order decisions were taken. */
  approvals: ApprovalItem[];
  /** Newest first. Empty until a draft has been sent. */
  drafts: DraftItem[];
};

export type DraftItem = {
  id: string;
  draftNumber: number;
  fileUrl: string;
  note: string | null;
  submittedByName: string | null;
  submittedAt: string;
};

type ChangeRequestRow = {
  id: string;
  document_id: string;
  requester_id: string;
  request_type: Enums<"document_request_type">;
  proposed_revision: string | null;
  reason_for_change: string;
  description_of_change: string;
  affected_processes: string | null;
  related_iso_requirements: string | null;
  proposed_effective_date: string | null;
  supporting_file_url: string | null;
  status: ChangeRequestStatus;
  created_at: string;
  updated_at: string;
  documents: {
    name: string;
    owner_id: string | null;
    departments: { code: string; name: string; user_roles: { roles: { key: string } | null }[] } | null;
    processes: { name: string } | null;
  } | null;
  requester: { full_name: string } | null;
  document_change_approvals: {
    id: string;
    stage: ApprovalStage;
    decision: ApprovalDecision;
    decided_at: string;
    reason: string | null;
    decider: { full_name: string } | null;
  }[];
  document_drafts: {
    id: string;
    draft_number: number;
    file_url: string;
    note: string | null;
    submitted_at: string;
    submitter: { full_name: string } | null;
  }[];
};

const CHANGE_REQUEST_SELECT = `id,
  document_id,
  requester_id,
  request_type,
  proposed_revision,
  reason_for_change,
  description_of_change,
  affected_processes,
  related_iso_requirements,
  proposed_effective_date,
  supporting_file_url,
  status,
  created_at,
  updated_at,
  documents (
    name,
    owner_id,
    departments ( code, name, user_roles ( roles ( key ) ) ),
    processes ( name )
  ),
  requester:profiles!document_change_requests_requester_id_fkey ( full_name ),
  document_change_approvals (
    id,
    stage,
    decision,
    decided_at,
    reason,
    decider:profiles!document_change_approvals_decided_by_fkey ( full_name )
  ),
  document_drafts (
    id,
    draft_number,
    file_url,
    note,
    submitted_at,
    submitter:profiles!document_drafts_submitted_by_fkey ( full_name )
  )`;

const hasManager = (userRoles: { roles: { key: string } | null }[]) =>
  userRoles.some((ur) => ur.roles?.key === "department_manager");

function toChangeRequest(r: ChangeRequestRow): ChangeRequestItem {
  const doc = r.documents;
  const fallback =
    doc && doc.owner_id === null && doc.departments && !hasManager(doc.departments.user_roles)
      ? { departmentCode: doc.departments.code }
      : null;
  return {
    id: r.id,
    documentId: r.document_id,
    documentName: r.documents?.name ?? "",
    requestType: r.request_type,
    departmentCode: doc?.departments?.code ?? null,
    departmentName: doc?.departments?.name ?? null,
    processName: doc?.processes?.name ?? null,
    requesterId: r.requester_id,
    requesterName: r.requester?.full_name ?? null,
    proposedRevision: r.proposed_revision,
    reasonForChange: r.reason_for_change,
    descriptionOfChange: r.description_of_change,
    affectedProcesses: r.affected_processes,
    relatedIsoRequirements: r.related_iso_requirements,
    proposedEffectiveDate: r.proposed_effective_date,
    supportingFileUrl: r.supporting_file_url,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    reviewFallback: fallback,
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
    drafts: [...r.document_drafts]
      .sort((a, b) => b.draft_number - a.draft_number)
      .map((d) => ({
        id: d.id,
        draftNumber: d.draft_number,
        fileUrl: d.file_url,
        note: d.note,
        submittedByName: d.submitter?.full_name ?? null,
        submittedAt: d.submitted_at,
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

/** Every status a request can sit in between being raised and finishing. */
const OPEN_STATUSES: ChangeRequestStatus[] = [
  "pending_owner",
  "pending_coordinator",
  "pending_extra_review",
  "pending_ims",
  "awaiting_draft",
  "pending_draft_check",
  "draft_returned",
  "pending_ims_document",
  "pending_final",
  "pending_document_control",
  "rejected",
];

const COORDINATOR_STATUSES = new Set<ChangeRequestStatus>([
  "pending_coordinator",
  "pending_draft_check",
  "pending_document_control",
]);
const IMS_STATUSES = new Set<ChangeRequestStatus>(["pending_ims", "pending_ims_document"]);

export type ApprovalQueues = {
  /** Open requests the signed-in user can decide right now. Never their own. */
  needsMyAction: ChangeRequestItem[];
  /** Every other open request they can see, so they know what it's waiting on. */
  waitingOnOthers: ChangeRequestItem[];
};

/**
 * The two approval-queue groupings for the signed-in user.
 *
 * DELIBERATE ACTORSHIP FILTER. RLS does not scope who is shown here to who
 * can actually decide: a requester reads their own request at every stage,
 * a coordinator/CTO/IMS admin reads every open request org-wide (is_ims()),
 * and a department manager reads every request on a document they review,
 * even past the stage they themselves decide. All of that belongs under
 * "waiting on others" unless the specific rule below says otherwise:
 *
 *   pending_owner            -> the document's reviewer (named owner, else
 *                                the department's manager, else IMS when
 *                                the department has no manager)
 *   pending_coordinator,
 *   pending_draft_check,
 *   pending_document_control -> qms_coordinator or isms_coordinator
 *   pending_ims,
 *   pending_ims_document     -> ims_admin
 *   pending_final             -> approver (CTO/VP)
 *
 * and never the request's own requester, mirroring
 * document_change_approvals_insert exactly. Do not remove these filters.
 */
export async function getApprovalQueues(): Promise<ApprovalQueues> {
  const user = await getCurrentUser();
  if (!user) return { needsMyAction: [], waitingOnOthers: [] };

  const supabase = await createClient();

  const iAmDocCoordinator = isDocCoordinator(user);
  const iAmImsAdmin = isAdmin(user);
  const iAmApprover = isExecutiveApprover(user);

  const managed = new Set(
    user.roles.filter((r) => r.key === "department_manager" && r.departmentId).map((r) => r.departmentId)
  );
  const { data: docs, error: docsError } = await supabase
    .from("documents")
    .select("id, owner_id, department_id, departments ( user_roles ( roles ( key ) ) )")
    .returns<
      { id: string; owner_id: string | null; department_id: string; departments: { user_roles: { roles: { key: string } | null }[] } | null }[]
    >();
  if (docsError) throw docsError;
  const ownedIds = new Set(
    (docs ?? [])
      .filter(
        (d) =>
          d.owner_id === user.id ||
          (d.owner_id === null && managed.has(d.department_id)) ||
          // Third arm: IMS steps in only where the department has no manager.
          (d.owner_id === null && iAmImsAdmin && !hasManager(d.departments?.user_roles ?? []))
      )
      .map((d) => d.id)
  );

  const { data, error } = await supabase
    .from("document_change_requests")
    .select(CHANGE_REQUEST_SELECT)
    .in("status", OPEN_STATUSES)
    .order("updated_at")
    .returns<ChangeRequestRow[]>();
  if (error) throw error;

  const needsMyAction: ChangeRequestItem[] = [];
  const waitingOnOthers: ChangeRequestItem[] = [];

  for (const row of data ?? []) {
    const item = toChangeRequest(row);
    const isMine = item.requesterId === user.id;
    const iCanAct =
      !isMine &&
      ((item.status === "pending_owner" && ownedIds.has(item.documentId)) ||
        (iAmDocCoordinator && COORDINATOR_STATUSES.has(item.status)) ||
        (iAmImsAdmin && IMS_STATUSES.has(item.status)) ||
        (iAmApprover && item.status === "pending_final"));
    (iCanAct ? needsMyAction : waitingOnOthers).push(item);
  }

  return { needsMyAction, waitingOnOthers };
}
