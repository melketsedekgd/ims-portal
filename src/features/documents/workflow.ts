import type { Enums } from "@/types/database";

/**
 * The approval-steps snapshot a change request carries in
 * document_change_requests.workflow, copied from the settings when it was
 * raised. Pure types and functions only — no server client — so client
 * components (the tracker, the request form) can import it by value.
 */

export type CoordinatorRole = "any" | "qms_coordinator" | "isms_coordinator";
export type ExtraReviewerRole = "department_manager" | "department_contributor";

export type WorkflowSnapshot = {
  coordinator_review?: { enabled?: boolean; role?: CoordinatorRole };
  draft_check?: { enabled?: boolean; role?: CoordinatorRole };
  final?: { enabled?: boolean };
  extra_review?: { reviewers?: { department_id: string; role: ExtraReviewerRole }[] };
};

/**
 * Mirrors workflow_step_enabled() in SQL. Only the three optional steps can
 * be off, and a missing key means on; the other-department step is on only
 * when the snapshot lists someone, so a request raised before it existed
 * has it off. owner, ims, ims_document and document_control are always on.
 */
export function stepEnabled(
  workflow: WorkflowSnapshot | null | undefined,
  stage: Enums<"approval_stage">
): boolean {
  switch (stage) {
    case "coordinator_review":
      return workflow?.coordinator_review?.enabled ?? true;
    case "draft_check":
      return workflow?.draft_check?.enabled ?? true;
    case "final":
      return workflow?.final?.enabled ?? true;
    case "extra_review":
      return (workflow?.extra_review?.reviewers?.length ?? 0) > 0;
    default:
      return true;
  }
}

/** Mirrors workflow_stage_roles(): the coordinator roles that may decide a step. 'any' or none means both. */
export function stageRoles(
  workflow: WorkflowSnapshot | null | undefined,
  stage: "coordinator_review" | "draft_check"
): string[] {
  const role = workflow?.[stage]?.role ?? "any";
  return role === "any" ? ["qms_coordinator", "isms_coordinator"] : [role];
}

export const COORDINATOR_ROLE_LABEL: Record<CoordinatorRole, string> = {
  any: "QMS or ISMS Coordinator",
  qms_coordinator: "QMS Coordinator",
  isms_coordinator: "ISMS Coordinator",
};

export const EXTRA_REVIEWER_ROLE_LABEL: Record<ExtraReviewerRole, string> = {
  department_manager: "Department Manager",
  department_contributor: "Department Contributor",
};
