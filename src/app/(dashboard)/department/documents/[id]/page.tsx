import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, GitBranch, History } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getDocumentWithHistory, getRequestableDepartments } from "@/features/documents/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { RequestChangeButton, ResubmitButton } from "@/features/documents/components/DocumentActions";
import { ChangeRequestCard } from "@/features/documents/components/ChangeRequestCard";
import { fmtDateTime } from "@/features/documents/components/ChangeRequestStatusBadge";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100">{children ?? "—"}</dd>
    </div>
  );
}

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [doc, user, departments] = await Promise.all([
    getDocumentWithHistory(id),
    getCurrentUser(),
    getRequestableDepartments(),
  ]);
  if (!doc) notFound();
  const defaultDepartmentId = user?.roles.find((r) => r.departmentId)?.departmentId ?? null;

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-start gap-4">
        <Link
          href="/department/approvals"
          className={`${buttonVariants({ variant: "ghost", size: "icon" })} shrink-0 mt-0.5`}
          aria-label="Back to documents"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {doc.department && (
              <Badge variant="outline" className="text-[11px] font-medium text-slate-500 bg-slate-50 dark:bg-zinc-900" title={doc.department.name}>
                {doc.department.code}
              </Badge>
            )}
            {doc.status === "retired" && (
              <Badge variant="outline" className="text-[11px] text-muted-foreground">Retired</Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{doc.name}</h1>
        </div>
        {doc.status === "active" && (
          <RequestChangeButton
            documents={[]}
            departments={departments}
            defaultDepartmentId={defaultDepartmentId}
            fixedDocument={doc}
          />
        )}
      </div>

      {/* ── Definition ── */}
      <section className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
            <FileText className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold tracking-tight">Document</h2>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
          <Field label="Document number"><span className="font-mono">{doc.documentNumber}</span></Field>
          {/* null is "never published", not revision zero. */}
          <Field label="Current revision">{doc.currentRevision ? <span className="font-mono">{doc.currentRevision}</span> : null}</Field>
          <Field label="Reviewer">{doc.reviewerName}</Field>
          <Field label="Department">{doc.department?.name}</Field>
          <Field label="Linked process">{doc.processName}</Field>
          <Field label="Location">
            {doc.storageUrl ? (
              <a
                href={doc.storageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:underline break-all"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                {doc.storageUrl}
              </a>
            ) : null}
          </Field>
        </dl>
      </section>

      {/* ── Change requests ── */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
            <GitBranch className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold tracking-tight">Change requests</h2>
        </div>
        {doc.changeRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-xl border border-dashed border-slate-200 dark:border-zinc-800 p-6 text-center">
            No change requests have been raised against this document.
          </p>
        ) : (
          doc.changeRequests.map((r) => (
            <ChangeRequestCard key={r.id} request={r}>
              {r.status === "rejected" && user && r.requesterId === user.id && (
                <ResubmitButton requestId={r.id} />
              )}
            </ChangeRequestCard>
          ))
        )}
      </section>

      {/* ── Revisions ── */}
      <section className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-5 md:px-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            <History className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold tracking-tight">Published revisions</h2>
        </div>
        {doc.revisions.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No revision has been published yet.</p>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
              <TableRow>
                <TableHead className="h-10 pl-6">Revision</TableHead>
                <TableHead className="h-10">Published by</TableHead>
                <TableHead className="h-10 pr-6">Published</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {doc.revisions.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="pl-6 font-mono font-medium">{r.revisionLabel}</TableCell>
                  <TableCell className="text-sm">{r.publishedBy ?? "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground pr-6">{fmtDateTime(r.publishedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
