import Link from "next/link";
import { ExternalLink, Inbox, ShieldCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import PageHeader from "@/components/shared/PageHeader";
import {
  getApprovalQueues,
  getDocumentTypes,
  getDocuments,
  getRequestableDepartments,
} from "@/features/documents/queries";
import { getCurrentUser } from "@/features/auth/queries";
import DecisionPanel from "@/features/documents/components/DecisionPanel";
import { PublishForm, RetireButton } from "@/features/documents/components/DocumentControlPanel";
import {
  ChangeRequestStatusBadge,
  REQUEST_TYPE_LABEL,
  STATUS_PHASE,
  fmtDate,
} from "@/features/documents/components/ChangeRequestStatusBadge";
import { RequestChangeButton } from "@/features/documents/components/DocumentActions";
import type { ChangeRequestItem, ChangeRequestStatus } from "@/features/documents/queries";
import type { DecisionInput } from "@/features/documents/schema";

/** Every status that reaches a DecisionPanel maps to the stage it decides. pending_document_control does not — it goes to PublishForm/RetireButton instead. */
const STATUS_STAGE: Partial<Record<ChangeRequestStatus, DecisionInput["stage"]>> = {
  pending_owner: "owner",
  pending_coordinator: "coordinator_review",
  pending_ims: "ims",
  pending_draft_check: "draft_check",
  pending_ims_document: "ims_document",
  pending_final: "final",
};

function NeedsActionItem({ request }: { request: ChangeRequestItem }) {
  if (request.status === "pending_document_control") {
    return request.requestType === "deletion"
      ? <RetireButton request={request} />
      : <PublishForm request={request} />;
  }
  const stage = STATUS_STAGE[request.status];
  if (!stage) return null;
  return <DecisionPanel request={request} stage={stage} />;
}

/** The lighter row for a request someone else will decide: enough to know what it is and what it's waiting on, a click away from the rest. */
function WaitingOnOthersTable({ items }: { items: ChangeRequestItem[] }) {
  return (
    <div className="rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
      <Table>
        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
          <TableRow>
            <TableHead className="h-10 pl-6">Document</TableHead>
            <TableHead className="h-10">Department / process</TableHead>
            <TableHead className="h-10">Request</TableHead>
            <TableHead className="h-10">Status</TableHead>
            <TableHead className="h-10 pr-6">Waiting since</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-sm text-muted-foreground">
                Nothing else is open right now.
              </TableCell>
            </TableRow>
          ) : (
            items.map((r) => {
              const phase = STATUS_PHASE[r.status];
              return (
                <TableRow key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                  <TableCell className="pl-6 font-medium">
                    <Link href={`/department/documents/${r.documentId}`} className="hover:underline">
                      {r.documentName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {[r.departmentCode, r.processName].filter(Boolean).join(" · ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {REQUEST_TYPE_LABEL[r.requestType]}
                    {r.proposedRevision && (
                      <span className="font-mono text-muted-foreground"> · {r.proposedRevision}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <ChangeRequestStatusBadge status={r.status} />
                      {phase && <span className="text-[10px] text-muted-foreground">Phase {phase}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground pr-6">{fmtDate(r.updatedAt)}</TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Controlled document change, on one page: the review queues first, then
 * the register. Both are indexes into /department/documents/[id], where
 * everything actually happens.
 *
 * "Needs my action" is role-aware: owner via the existing reviewer logic,
 * coordinator statuses for qms/isms coordinators, IMS statuses for
 * ims_admin, pending_final for the approver — see getApprovalQueues.
 * "Waiting on others" is every other open request the signed-in user can
 * see, including their own.
 */
export default async function ApprovalsPage() {
  const [queues, documents, departments, documentTypes, user] = await Promise.all([
    getApprovalQueues(),
    getDocuments(),
    getRequestableDepartments(),
    getDocumentTypes(),
    getCurrentUser(),
  ]);
  const defaultDepartmentId = user?.roles.find((r) => r.departmentId)?.departmentId ?? null;
  // Hidden by default: a proposed document hasn't finished change control yet,
  // and a retired one is no longer current — neither belongs in the register.
  const activeDocuments = documents.filter((d) => d.status === "active");

  return (
    <div className="flex-1 space-y-8 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Document Control"
        description="Document change requests waiting for your decision, and the documents under change control."
      />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 text-ink-2"><Inbox className="h-4 w-4" /></div>
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

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-slate-100 text-ink-2"><ShieldCheck className="h-4 w-4" /></div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">
              Waiting on others
              <span className="ml-2 text-xs font-medium text-muted-foreground">{queues.waitingOnOthers.length}</span>
            </h2>
            <p className="text-xs text-muted-foreground">Open requests you can see, and who they&rsquo;re waiting on.</p>
          </div>
        </div>
        <WaitingOnOthersTable items={queues.waitingOnOthers} />
      </section>

      {/* ── Register ── */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-ink">Controlled Documents</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Procedures and work instructions that have been through change control, and their current revision.
            </p>
          </div>
          <RequestChangeButton
            documents={activeDocuments}
            departments={departments}
            documentTypes={documentTypes}
            defaultDepartmentId={defaultDepartmentId}
          />
        </div>

        <div className="rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="h-10 pl-6">Document</TableHead>
                <TableHead className="h-10">Number</TableHead>
                <TableHead className="h-10">Current revision</TableHead>
                <TableHead className="h-10">Reviewer</TableHead>
                <TableHead className="h-10">Department</TableHead>
                <TableHead className="h-10 pr-6">Process</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeDocuments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No document has been through change control yet. Raise the first request to add one.
                  </TableCell>
                </TableRow>
              ) : (
                activeDocuments.map((d) => (
                  <TableRow key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/50">
                    <TableCell className="pl-6 font-medium">
                      <Link href={`/department/documents/${d.id}`} className="hover:underline">
                        {d.name}
                      </Link>
                      {d.storageUrl && (
                        <a
                          href={d.storageUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 inline-flex align-middle text-muted-foreground hover:text-[var(--ink)]"
                          title="Open the document"
                          aria-label={`Open ${d.name}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground font-mono">{d.documentNumber ?? "—"}</TableCell>
                    {/* null is "never published", not revision zero. */}
                    <TableCell className="text-sm font-mono">{d.currentRevision ?? "—"}</TableCell>
                    <TableCell className="text-sm">{d.reviewerName ?? "—"}</TableCell>
                    <TableCell className="text-sm" title={d.department?.name}>{d.department?.code ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground pr-6">{d.processName ?? "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
