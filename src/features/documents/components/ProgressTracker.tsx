import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { PHASE1_STAGES, STAGE_LABEL, STAGE_ORDER, STATUS_STAGE, fmtDateTime } from "./ChangeRequestStatusBadge"
import { EXTRA_REVIEWER_ROLE_LABEL, stepEnabled, type ExtraReviewerRole } from "@/features/documents/workflow"
import type { ApprovalStage, ChangeRequestItem, ExtraReviewSlot } from "@/features/documents/queries"

type Current = { index: number; tag: string | null }

/** A deletion goes from IMS approval straight to document control. */
const DELETION_SKIPS = new Set<ApprovalStage>(["draft_check", "ims_document", "final"])

/** This request's own stages: the ones its snapshot has on, less the draft steps for a deletion. */
function stagesOf(request: ChangeRequestItem): ApprovalStage[] {
  return STAGE_ORDER.filter(
    (s) => stepEnabled(request.workflow, s) && !(request.requestType === "deletion" && DELETION_SKIPS.has(s))
  )
}

/** Which of `stages` the request is sitting at: -1 before the first, stages.length once finished. */
function currentOf(request: ChangeRequestItem, stages: ApprovalStage[], viewerDecides: boolean): Current {
  const stage = STATUS_STAGE[request.status]
  if (stage) return { index: stages.indexOf(stage), tag: viewerDecides ? "Waiting · you" : "Waiting" }
  switch (request.status) {
    case "awaiting_draft":
    case "draft_returned":
      // The draft goes to the first phase-2 stage: draft check, or the IMS
      // Manager when draft check is off.
      return { index: stages.findIndex((s) => !PHASE1_STAGES.has(s)), tag: "Waiting · draft" }
    case "published":
    case "retired":
      return { index: stages.length, tag: null }
    case "rejected": {
      const last = request.approvals[request.approvals.length - 1]
      return { index: last ? Math.max(0, stages.indexOf(last.stage)) : 0, tag: "Returned" }
    }
    default:
      return { index: -1, tag: null }
  }
}

const phaseLabel =
  "mx-2 pb-1.5 border-b-[3px] text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground"

/** Short enough for a tracker column; the full label is on hover. */
const ROLE_SHORT: Record<ExtraReviewerRole, string> = {
  department_manager: "Manager",
  department_contributor: "Contributor",
}

/**
 * "N of M approved" for the other-department step, counted by slot: M
 * leaves out slots the database counts as satisfied because nobody but the
 * requester holds them.
 */
function extraReviewProgress(slots: ExtraReviewSlot[]): string {
  const needed = slots.filter((s) => !s.skipped)
  return `${needed.filter((s) => s.approval).length} of ${needed.length} approved`
}

/** Each reviewer slot and where it stands: who approved it and when, waiting, or not needed. */
function ExtraReviewSlots({ slots }: { slots: ExtraReviewSlot[] }) {
  return (
    <ul className="space-y-1 text-xs leading-snug text-muted-foreground">
      {slots.map((s) => (
        <li key={`${s.departmentId}:${s.role}`} title={`${s.departmentName} · ${EXTRA_REVIEWER_ROLE_LABEL[s.role]}`}>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {s.departmentCode} {ROLE_SHORT[s.role]}
          </span>
          <br />
          {s.approval ? (
            <>
              {s.approval.by ?? "—"}
              <br />
              {fmtDateTime(s.approval.at)}
            </>
          ) : s.skipped ? (
            <span title="Nobody but the requester holds this role, so it is not needed">Not needed</span>
          ) : (
            "Waiting"
          )}
        </li>
      ))}
    </ul>
  )
}

/**
 * The request's own stages as a row of steps — only those its snapshot has
 * on, and no draft steps for a deletion. Done ones carry who approved them
 * and when, the current one says who it is waiting on. A stage that was
 * returned and then decided again keeps a "Returned" note, with the
 * reasons on hover.
 */
export function ProgressTracker({
  request,
  viewerDecides = false,
}: {
  request: ChangeRequestItem
  viewerDecides?: boolean
}) {
  const stages = stagesOf(request)
  const { index: current, tag } = currentOf(request, stages, viewerDecides)
  const count = stages.length
  const lastIndex = count - 1
  const phase1Count = stages.filter((s) => PHASE1_STAGES.has(s)).length
  const phase2Count = count - phase1Count
  const fill = Math.max(0, Math.min(current, lastIndex)) / lastIndex
  const columns = { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }
  const inset = `${50 / count}%`

  const phaseRule = (first: number, last: number) =>
    current > last
      ? "border-coral"
      : current >= first
        ? "border-[var(--coral-soft)]"
        : "border-slate-200 dark:border-slate-800"

  return (
    <div className="overflow-x-auto rounded-xl border-2 border-slate-200 dark:border-slate-800">
      <div className="min-w-[640px] px-3 py-5 space-y-3.5">
        <div className="grid" style={columns}>
          {phase1Count > 0 && (
            <p className={cn(phaseLabel, phaseRule(0, phase1Count - 1))} style={{ gridColumn: `span ${phase1Count}` }}>
              Phase 1 — Permission
            </p>
          )}
          {phase2Count > 0 && (
            <p className={cn(phaseLabel, phaseRule(phase1Count, lastIndex))} style={{ gridColumn: `span ${phase2Count}` }}>
              Phase 2 — Draft
            </p>
          )}
        </div>

        <div className="relative">
          <div
            className="absolute top-[14px] h-1.5 rounded-full bg-slate-200 dark:bg-slate-800"
            style={{ left: inset, right: inset }}
            aria-hidden
          >
            <div className="h-full rounded-full bg-coral" style={{ width: `${fill * 100}%` }} />
          </div>

          <ol className="relative grid" style={columns}>
            {stages.map((stage, i) => {
              const state = i < current ? "done" : i === current ? "current" : "future"
              const decisions = request.approvals.filter((a) => a.stage === stage)
              const approved = decisions.filter((a) => a.decision === "approved").pop()
              // A return only counts once the stage has been decided again after it.
              const returns = decisions.filter((a, j) => a.decision === "rejected" && j < decisions.length - 1)
              return (
                <li
                  key={stage}
                  aria-current={state === "current" ? "step" : undefined}
                  className="flex flex-col items-center gap-2 px-1.5 text-center"
                >
                  {state === "done" && (
                    <span className="flex size-[34px] items-center justify-center rounded-full bg-coral">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
                    </span>
                  )}
                  {state === "current" && (
                    <span className="flex size-[34px] items-center justify-center rounded-full border-4 border-coral bg-white dark:bg-slate-950 shadow-[0_0_0_5px_var(--coral-tint)]">
                      <span className="size-2.5 rounded-full bg-coral" />
                    </span>
                  )}
                  {state === "future" && (
                    <span className="size-[34px] rounded-full border-[3px] border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950" />
                  )}

                  <span
                    className={cn(
                      "text-sm",
                      state === "current" && "font-semibold",
                      state === "future" ? "text-muted-foreground" : "text-slate-900 dark:text-slate-100"
                    )}
                  >
                    {STAGE_LABEL[stage]}
                  </span>

                  {state === "done" && stage === "extra_review" && <ExtraReviewSlots slots={request.extraReviewSlots} />}
                  {state === "done" && stage !== "extra_review" && approved && (
                    <span className="text-xs leading-snug text-muted-foreground">
                      {approved.decidedBy ?? "—"}
                      <br />
                      {fmtDateTime(approved.decidedAt)}
                    </span>
                  )}
                  {state === "current" && tag && (
                    <span className="rounded-full bg-[var(--coral-tint)] px-2.5 py-0.5 text-xs font-medium text-[var(--coral-600)]">
                      {tag}
                    </span>
                  )}
                  {state === "current" && stage === "extra_review" && (
                    <>
                      <span className="text-xs leading-snug text-muted-foreground">
                        {extraReviewProgress(request.extraReviewSlots)}
                      </span>
                      <ExtraReviewSlots slots={request.extraReviewSlots} />
                    </>
                  )}
                  {returns.length > 0 && (
                    <span
                      className="text-[11px] font-medium text-rose-600 dark:text-rose-400"
                      title={returns.map((r) => r.reason).filter(Boolean).join("\n\n") || undefined}
                    >
                      {returns.length === 1 ? "Returned once" : `Returned ${returns.length} times`}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    </div>
  )
}

/** The short step names from the approval settings' STEPS, so a phone-width tracker reads the same as its preview. */
const STAGE_SHORT: Record<ApprovalStage, string> = {
  owner: "Owner",
  coordinator_review: "Coordinator",
  extra_review: "Other depts",
  ims: "IMS Manager",
  draft_check: "Draft check",
  ims_document: "IMS Manager",
  final: "CTO/VP",
  document_control: "Document control",
}

/**
 * The same stages as ProgressTracker, small enough for a table row's
 * expanded panel: one row per phase in the approval settings preview's
 * style, numbered across both phases. Each phase row scrolls inside
 * itself rather than widening the page.
 */
export function CompactProgressTracker({
  request,
  viewerDecides = false,
}: {
  request: ChangeRequestItem
  viewerDecides?: boolean
}) {
  const stages = stagesOf(request)
  const { index: current, tag } = currentOf(request, stages, viewerDecides)

  const track = (phase: 1 | 2) => {
    const list = stages
      .map((stage, i) => ({ stage, i }))
      .filter(({ stage }) => PHASE1_STAGES.has(stage) === (phase === 1))
    if (list.length === 0) return null
    return (
      <div className="min-w-0 space-y-2">
        <p className="text-xs font-semibold text-ink-2 dark:text-slate-300">
          {phase === 1 ? "Phase 1 — Permission" : "Phase 2 — Draft"}
        </p>
        <div className="overflow-x-auto">
          <ol className="flex w-max">
            {list.map(({ stage, i }, j) => {
              const state = i < current ? "done" : i === current ? "current" : "future"
              return (
                <li
                  key={stage}
                  aria-current={state === "current" ? "step" : undefined}
                  className="relative flex w-[72px] shrink-0 flex-col items-center gap-1.5 text-center"
                >
                  {/* The line in from the previous step, centre to centre. */}
                  {j > 0 && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-[14px] right-1/2 h-[3px] w-full",
                        state === "done" ? "bg-coral" : "bg-slate-200 dark:bg-slate-800"
                      )}
                    />
                  )}
                  {state === "done" ? (
                    <span className="relative z-10 flex size-[31px] items-center justify-center rounded-full bg-coral">
                      <Check className="h-4 w-4 text-white" strokeWidth={3} aria-hidden />
                    </span>
                  ) : (
                    <span
                      className={cn(
                        "relative z-10 flex size-[31px] items-center justify-center rounded-full border-[3px] bg-white dark:bg-slate-950 font-mono text-xs",
                        state === "current"
                          ? "border-coral text-[var(--coral-600)]"
                          : "border-slate-300 dark:border-slate-700 text-muted-foreground"
                      )}
                    >
                      {i + 1}
                    </span>
                  )}
                  <span
                    className={cn(
                      "text-xs leading-snug",
                      state === "current" && "font-semibold",
                      state === "future" ? "text-muted-foreground" : "text-ink-2 dark:text-slate-300"
                    )}
                    title={STAGE_LABEL[stage]}
                  >
                    {STAGE_SHORT[stage]}
                  </span>
                  {state === "current" && tag && (
                    <span className="rounded-full bg-[var(--coral-tint)] px-1.5 py-0.5 text-[10px] font-medium leading-tight text-[var(--coral-600)]">
                      {tag}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {track(1)}
      {track(2)}
    </div>
  )
}
