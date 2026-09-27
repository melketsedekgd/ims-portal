import PageHeader from "@/components/shared/PageHeader";
import {
  getApprovalQueues,
  getDocumentTypes,
  getDocuments,
  getRequestableDepartments,
  getWorkflowSettings,
} from "@/features/documents/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { RequestChangeButton } from "@/features/documents/components/DocumentActions";
import { RequestsTableContainer } from "@/features/documents/components/RequestsTableContainer";

/**
 * Controlled document change requests and register.
 *
 * Incoming requests requiring immediate user action live in /department/actions (Action Center).
 * This page focuses on the controlled document register and tracking open requests across departments.
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
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6">
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
