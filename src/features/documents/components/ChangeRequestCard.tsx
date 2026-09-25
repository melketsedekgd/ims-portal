import { ExternalLink, ShieldAlert } from "lucide-react"
import {
  ChangeRequestStatusBadge,
  DecisionBadge,
  REQUEST_TYPE_LABEL,
  STAGE_LABEL,
  STATUS_PHASE,
  fmtDateTime,
  fmtDate,
} from "./ChangeRequestStatusBadge"
import type { ApprovalDecision, ApprovalStage, ChangeRequestItem } from "@/features/documents/queries"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-wrap">{children ?? "—"}</dd>
    </div>
  )
}

type TimelineEntry =
  | { kind: "approval"; id: string; at: string; stage: ApprovalStage; decision: ApprovalDecision; by: string | null; reason: string | null }
  | { kind: "draft"; id: string; at: string; draftNumber: number; fileUrl: string; note: string | null; by: string | null };

/** owner/coordinator_review/ims decide phase 1 (permission); everything else, including a draft, is phase 2 (the document). */
const PHASE1_STAGES = new Set<ApprovalStage>(["owner", "coordinator_review", "ims"]);

function timelineOf(request: ChangeRequestItem): TimelineEntry[] {
  const approvals: TimelineEntry[] = request.approvals.map((a) => ({
    kind: "approval",
    id: a.id,
    at: a.decidedAt,
    stage: a.stage,
    decision: a.decision,
    by: a.decidedBy,
    reason: a.reason,
  }));
  const drafts: TimelineEntry[] = request.drafts.map((d) => ({
    kind: "draft",
    id: d.id,
    at: d.submittedAt,
    draftNumber: d.draftNumber,
    fileUrl: d.fileUrl,
    note: d.note,
    by: d.submittedByName,
  }));
  return [...approvals, ...drafts].sort((a, b) => a.at.localeCompare(b.at));
}

function TimelineRow({ entry }: { entry: TimelineEntry }) {
  if (entry.kind === "draft") {
    return (
      <li className="px-3 py-2 text-sm space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Draft {entry.draftNumber}</span>
          <a
            href={entry.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
          >
            <ExternalLink className="h-3 w-3" /> file
          </a>
          <span className="text-xs text-muted-foreground">{entry.by ?? "—"} · {fmtDateTime(entry.at)}</span>
        </div>
        {entry.note && <p className="text-muted-foreground whitespace-pre-wrap">{entry.note}</p>}
      </li>
    );
  }
  return (
    <li className="px-3 py-2 text-sm space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{STAGE_LABEL[entry.stage]}</span>
        <DecisionBadge decision={entry.decision} />
        <span className="text-xs text-muted-foreground">{entry.by ?? "—"} · {fmtDateTime(entry.at)}</span>
      </div>
      {entry.reason && (
        <p className="text-muted-foreground whitespace-pre-wrap">
          <span className="font-medium text-slate-700 dark:text-slate-300">Reason:</span> {entry.reason}
        </p>
      )}
    </li>
  );
}

/**
 * One phase's slice of the timeline, oldest first, with a highlighted
 * "current" row appended when the request is presently sitting in this
 * phase — there is no recorded event for "waiting", so it is drawn rather
 * than read off a row.
 */
function TimelinePhase({
  title,
  entries,
  current,
}: {
  title: string;
  entries: TimelineEntry[];
  current: ChangeRequestItem["status"] | null;
}) {
  if (entries.length === 0 && !current) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <ol className="divide-y divide-slate-200 dark:divide-slate-800 rounded-md border border-slate-200 dark:border-slate-800">
        {entries.map((e) => <TimelineRow key={e.id} entry={e} />)}
        {current && (
          <li className="flex items-center gap-2 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" aria-hidden />
            <ChangeRequestStatusBadge status={current} />
            <span className="text-xs text-muted-foreground">current</span>
          </li>
        )}
      </ol>
    </div>
  );
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
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showDocument && (
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400 mb-1">
              {request.documentName}
              {(request.departmentCode || request.processName) && (
                <span className="ml-2 font-medium normal-case tracking-normal text-muted-foreground">
                  {[request.departmentCode, request.processName].filter(Boolean).join(" · ")}
                </span>
              )}
            </p>
          )}
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {REQUEST_TYPE_LABEL[request.requestType]}
            {request.proposedRevision && <> — <span className="font-mono">{request.proposedRevision}</span></>}
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

      {(() => {
        const entries = timelineOf(request);
        const phase1 = entries.filter((e) => e.kind === "approval" && PHASE1_STAGES.has(e.stage));
        const phase2 = entries.filter((e) => !(e.kind === "approval" && PHASE1_STAGES.has(e.stage)));
        const currentPhase = STATUS_PHASE[request.status];
        if (entries.length === 0 && currentPhase === null) {
          return (
            <div className="space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">History</p>
              <p className="text-sm text-muted-foreground">Nothing recorded yet.</p>
            </div>
          );
        }
        return (
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">History</p>
            <TimelinePhase title="Phase 1 — permission" entries={phase1} current={currentPhase === 1 ? request.status : null} />
            <TimelinePhase title="Phase 2 — the document" entries={phase2} current={currentPhase === 2 ? request.status : null} />
          </div>
        );
      })()}

      {children}
    </div>
  )
}
