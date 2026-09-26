import { Inbox } from "lucide-react";
import PageHeader from "@/components/shared/PageHeader";
import {
  getApprovalQueues,
  getDocumentTypes,
  getDocuments,
  getRequestableDepartments,
  getWorkflowSettings,
} from "@/features/documents/queries";
import { getCurrentUser } from "@/features/auth/queries";
import DecisionPanel from "@/features/documents/components/DecisionPanel";
import { PublishForm, RetireButton } from "@/features/documents/components/DocumentControlPanel";
import { STATUS_STAGE } from "@/features/documents/components/ChangeRequestStatusBadge";
import { RequestChangeButton } from "@/features/documents/components/DocumentActions";
import { RequestsTableContainer } from "@/features/documents/components/RequestsTableContainer";
import type { ChangeRequestItem } from "@/features/documents/queries";

function NeedsActionItem({ request }: { request: ChangeRequestItem }) {
  if (request.status === "pending_document_control") {
    return request.requestType === "deletion"
      ? <RetireButton request={request} />
      : <PublishForm request={request} />;
  }
  const stage = STATUS_STAGE[request.status];
  // document_control is decided by PublishForm/RetireButton above, never a DecisionPanel.
  if (!stage || stage === "document_control") return null;
  return <DecisionPanel request={request} stage={stage} />;
}

/**
 * Controlled document change, on one page: the review queues first, then
 * the register. Both are indexes into /department/documents/[id], where
 * everything actually happens.
 *
 * "Needs my action" is role-aware: owner via the existing reviewer logic,
 * coordinator statuses for the coordinator the request assigns them to,
 * pending_extra_review for the other-department reviewers it lists, IMS
 * statuses for ims_admin, pending_final for the approver — see
 * getApprovalQueues.
 * "Waiting on others" is every other open request the signed-in user can
 * see, including their own.
 */
export default async function ApprovalsPage() {
  const [queues, documents, departments, documentTypes, workflowSettings, user] = await Promise.all([
    getApprovalQueues(),
    getDocuments(),
    getRequestableDepartments(),
    getDocumentTypes(),
    getWorkflowSettings(),
    getCurrentUser(),
  ]);
  const defaultDepartmentId = user?.roles.find((r) => r.departmentId)?.departmentId ?? null;
  // Hidden by default: a proposed document hasn't finished change control yet,
  // and a retired one is no longer current — neither belongs in the register.
  const activeDocuments = documents.filter((d) => d.status === "active");

  return (
    <div className="flex-1 space-y-8 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Requests"
        description="Document change requests waiting for your decision, and the documents under change control."
        actions={
          <RequestChangeButton
            documents={activeDocuments}
            departments={departments}
            documentTypes={documentTypes}
            workflowSettings={workflowSettings}
            defaultDepartmentId={defaultDepartmentId}
          />
        }
      />

      {/* ── Needs my action (Urgent items on top) ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 text-ink-2 dark:bg-slate-800 dark:text-slate-200">
            <Inbox className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">
              Needs my action
              <span className="ml-2 text-xs font-medium text-muted-foreground">{queues.needsMyAction.length}</span>
            </h2>
            <p className="text-xs text-muted-foreground">Open requests you can decide right now.</p>
          </div>
        </div>
        {queues.needsMyAction.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
            Nothing is waiting for your decision.
          </p>
        ) : (
          queues.needsMyAction.map((r) => <NeedsActionItem key={r.id} request={r} />)
        )}
      </section>

      {/* ── Unified Pill Tabs Table (Controlled Documents vs Waiting on Others) ── */}
      <section className="space-y-4">
        <RequestsTableContainer
          activeDocuments={activeDocuments}
          waitingOnOthers={queues.waitingOnOthers}
          departments={departments}
        />
      </section>
    </div>
  );
}
