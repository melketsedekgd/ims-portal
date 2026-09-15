import { ShieldAlert } from "lucide-react"
import { ChangeRequestStatusBadge, DecisionBadge, STAGE_LABEL, fmtDateTime, fmtDate } from "./ChangeRequestStatusBadge"
import type { ChangeRequestItem } from "@/features/documents/queries"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{children ?? "—"}</dd>
    </div>
  )
}

/**
 * One change request: what was asked, and every decision taken on it.
 * Used on the document page and inside the approvals decision panel;
 * `showDocument` adds the document name for contexts that list many.
 */
export function ChangeRequestCard({
  request,
  showDocument = false,
  children,
}: {
  request: ChangeRequestItem
  showDocument?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showDocument && (
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400 mb-1">{request.documentName}</p>
          )}
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            Proposed revision <span className="font-mono">{request.proposedRevision}</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Requested by {request.requesterName ?? "—"} · {fmtDateTime(request.createdAt)}
          </p>
        </div>
        <ChangeRequestStatusBadge status={request.status} />
      </div>

      {/* The owner stage is IMS's only because nobody else can take it.
          Said here so IMS deciding both stages is an explained record. */}
      {request.reviewFallback && (
        <p className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-300">
          <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
          Owner stage reviewed by IMS: {request.reviewFallback.departmentCode} has no department manager.
        </p>
      )}

      <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3">
        <div className="md:col-span-2"><Field label="Reason for change">{request.reasonForChange}</Field></div>
        <div className="md:col-span-2"><Field label="Description of change">{request.descriptionOfChange}</Field></div>
        <Field label="Affected processes">{request.affectedProcesses}</Field>
        <Field label="Related ISO requirements">{request.relatedIsoRequirements}</Field>
        <Field label="Proposed effective date">
          {request.proposedEffectiveDate ? fmtDate(request.proposedEffectiveDate) : null}
        </Field>
      </dl>

      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Decisions</p>
        {request.approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No decisions recorded yet.</p>
        ) : (
          <ol className="divide-y divide-slate-200 dark:divide-zinc-800 rounded-md border border-slate-200 dark:border-zinc-800">
            {request.approvals.map((a) => (
              <li key={a.id} className="px-3 py-2 text-sm space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{STAGE_LABEL[a.stage]}</span>
                  <DecisionBadge decision={a.decision} />
                  <span className="text-xs text-muted-foreground">
                    {a.decidedBy ?? "—"} · {fmtDateTime(a.decidedAt)}
                  </span>
                </div>
                {a.reason && (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    <span className="font-medium text-slate-700 dark:text-slate-300">Reason:</span> {a.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </div>

      {children}
    </div>
  )
}
