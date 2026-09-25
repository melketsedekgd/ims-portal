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
import { Badge } from "@/components/ui/badge";
import PageHeader from "@/components/shared/PageHeader";
import {
  getApprovalQueues,
  getDocuments,
  getRequestableDepartments,
} from "@/features/documents/queries";
import { getCurrentUser } from "@/features/auth/queries";
import DecisionPanel from "@/features/documents/components/DecisionPanel";
import { RequestChangeButton } from "@/features/documents/components/DocumentActions";
import type { ChangeRequestItem } from "@/features/documents/queries";
import type { DecisionInput } from "@/features/documents/schema";

function Queue({
  title,
  hint,
  icon,
  stage,
  items,
}: {
  title: string;
  hint: string;
  icon: React.ReactNode;
  stage: DecisionInput["stage"];
  items: ChangeRequestItem[];
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-slate-100 text-ink-2">{icon}</div>
        <div>
          <h2 className="text-sm font-bold tracking-tight">
            {title}
            <span className="ml-2 text-xs font-medium text-muted-foreground">{items.length}</span>
          </h2>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center">
          Nothing is waiting for your decision.
        </p>
      ) : (
        items.map((r) => <DecisionPanel key={r.id} request={r} stage={stage} />)
      )}
    </section>
  );
}

/**
 * Controlled document change, on one page: the review queues first, then
 * the register. Both are indexes into /department/documents/[id], where
 * everything actually happens.
 *
 * Only the queues that apply to the signed-in user are rendered. The IMS
 * queue is null, not empty, for anyone without an IMS-admin role — see
 * getApprovalQueues for why status alone cannot decide this.
 */
export default async function ApprovalsPage() {
  const [queues, documents, departments, user] = await Promise.all([
    getApprovalQueues(),
    getDocuments(),
    getRequestableDepartments(),
    getCurrentUser(),
  ]);
  const defaultDepartmentId = user?.roles.find((r) => r.departmentId)?.departmentId ?? null;

  return (
    <div className="flex-1 space-y-8 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Document Control"
        description="Document change requests waiting for your decision, and the documents under change control."
      />

      <Queue
        title="Owner review"
        hint="Change requests at the owner review stage, for documents you review."
        icon={<Inbox className="h-4 w-4" />}
        stage="owner"
        items={queues.owner}
      />

      {queues.ims !== null && (
        <Queue
          title="IMS review"
          hint="Change requests approved by their owner, awaiting IMS."
          icon={<ShieldCheck className="h-4 w-4" />}
          stage="ims"
          items={queues.ims}
        />
      )}

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
            documents={documents.filter((d) => d.status === "active")}
            departments={departments}
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
              {documents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-sm text-muted-foreground">
                    No document has been through change control yet. Raise the first request to add one.
                  </TableCell>
                </TableRow>
              ) : (
                documents.map((d) => (
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
                      {d.status === "retired" && (
                        <Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">Retired</Badge>
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
