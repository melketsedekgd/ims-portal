"use client"

import { useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { recordRiskReview } from "@/features/risks/mutations"
import { riskReviewSchema, treatmentEffectivenessValues } from "@/features/risks/schema"
import type { RiskListItem, RiskScoreContext } from "@/features/risks/queries"
import type { PeriodEntryState } from "@/features/periods/queries"
import type { Enums } from "@/types/database"
import { riskBand, RISK_BAND_LABEL } from "@/features/risks/scoring"
import { EFFECTIVENESS_LABEL, TREATMENT_STATUS_LABEL } from "@/features/risks/labels"
import { PILL, RISK_BAND_PILL, TREATMENT_STATUS } from "@/components/shared/status-styles"
import {
  FieldError,
  GrowingTextarea,
  Optional,
  RatingButtons,
  Req,
  textareaClass,
} from "@/features/risks/components/RiskDefinitionForm"

type Effectiveness = Enums<"treatment_effectiveness">

const EFFECTIVENESS_HINT: Record<Effectiveness, string> = {
  maintain: "Working as planned",
  correction: "Needs an adjustment",
  corrective_action: "Not working; fix the cause",
}

type Field = "severity" | "likelihood" | "effectiveness" | "reasonForDeviation" | "followupMeasure"
type FieldErrors = Partial<Record<Field, string>>

const PART = "text-xs font-bold uppercase tracking-wider text-muted-foreground"

// Fixed locale and zone, as on the risk page: a target date should not move
// with the viewer's machine.
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })

const scoreText = (rpn: number) => `${rpn} · ${RISK_BAND_LABEL[riskBand(rpn)]}`

/**
 * Maintain / Correction / Corrective action as a radio group of cards. One
 * stop in the tab order — the checked card, or the first while none is —
 * and the arrow keys move the choice, as a native radio group does.
 */
function EffectivenessCards({
  value,
  onChange,
  disabled,
  error,
}: {
  value: Effectiveness | null
  onChange: (e: Effectiveness) => void
  disabled: boolean
  error?: string
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const n = treatmentEffectivenessValues.length

  const moveTo = (i: number) => {
    const next = (i + n) % n
    onChange(treatmentEffectivenessValues[next])
    buttons.current[next]?.focus()
  }

  return (
    <div className="space-y-2">
      <Label id="review-effectiveness">Effectiveness <Req /></Label>
      <div
        role="radiogroup"
        aria-labelledby="review-effectiveness"
        aria-describedby={error ? "review-effectiveness-error" : undefined}
        className="grid grid-cols-1 gap-2 sm:grid-cols-3"
      >
        {treatmentEffectivenessValues.map((e, i) => {
          const checked = value === e
          return (
            <button
              key={e}
              ref={(el) => {
                buttons.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked || (value === null && i === 0) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(e)}
              onKeyDown={(ev) => {
                if (ev.key === "ArrowRight" || ev.key === "ArrowDown") {
                  ev.preventDefault()
                  moveTo(i + 1)
                } else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp") {
                  ev.preventDefault()
                  moveTo(i - 1)
                }
              }}
              className={`flex min-h-16 flex-col items-start gap-1 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 ${
                checked
                  ? "border-2 border-primary bg-slate-50 dark:bg-slate-900"
                  : `border bg-white dark:bg-slate-950 hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      error ? "border-destructive" : "border-input"
                    }`
              }`}
            >
              <span className="text-sm font-semibold">{EFFECTIVENESS_LABEL[e]}</span>
              <span className="text-xs text-muted-foreground">{EFFECTIVENESS_HINT[e]}</span>
            </button>
          )
        })}
      </div>
      <FieldError id="review-effectiveness-error" message={error} />
    </div>
  )
}

/**
 * One quarter's review of a risk: the residual score now, and — when the
 * risk has a treatment — whether that treatment is working. Both are saved
 * together by recordRiskReview, or neither is.
 *
 * Opens pre-filled with whatever the period already holds, so reopening
 * edits the saved review rather than starting over. The baseline is
 * pre-treatment and period-less; it is shown for comparison, not edited.
 */
export default function AssessmentDialog({
  risk,
  context,
  period,
  periodLabel,
  onClose,
}: {
  risk: RiskListItem
  /** Baseline and previous score, when the risk has them. */
  context: RiskScoreContext | undefined
  period: PeriodEntryState
  /** "Q3 2026" — for the title and the success toast. */
  periodLabel: string
  onClose: () => void
}) {
  const treatment = risk.currentTreatment
  const saved = treatment?.review ?? null

  const [severity, setSeverity] = useState<number | null>(risk.severity)
  const [likelihood, setLikelihood] = useState<number | null>(risk.likelihood)
  const [notes, setNotes] = useState(risk.notes ?? "")
  const [effectiveness, setEffectiveness] = useState<Effectiveness | null>(saved?.effectiveness ?? null)
  const [solutionEvidence, setSolutionEvidence] = useState(saved?.solutionEvidence ?? "")
  const [reasonForDeviation, setReasonForDeviation] = useState(saved?.reasonForDeviation ?? "")
  const [followupMeasure, setFollowupMeasure] = useState(saved?.followupMeasure ?? "")
  const [errors, setErrors] = useState<FieldErrors>({})
  const [pending, startTransition] = useTransition()

  // The insert/update policies refuse writes to a closed period for everyone
  // but IMS admins. Disabling here is the explanation, not the enforcement.
  const closed = period.status === "closed"
  const locked = closed || pending

  /** Wraps a setter so editing a field clears its error. */
  const edit =
    <T,>(field: Field, set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
    }

  // Preview only. The stored rpn is the generated column; this lets the user
  // see the band before saving, with the thresholds the register uses.
  const rpn = severity !== null && likelihood !== null ? severity * likelihood : null
  const band = riskBand(rpn)
  const deviating = effectiveness !== null && effectiveness !== "maintain"

  const handleSave = () => {
    const parsed = riskReviewSchema.safeParse({
      riskId: risk.id,
      reportingPeriodId: period.id,
      severity: severity ?? undefined,
      likelihood: likelihood ?? undefined,
      notes,
      treatment: treatment
        ? {
            treatmentId: treatment.id,
            effectiveness: effectiveness ?? undefined,
            solutionEvidence,
            reasonForDeviation,
            followupMeasure,
          }
        : null,
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path.at(-1) as Field
        next[field] ??= issue.message
      }
      // Unpicked is not "out of range": say what to do.
      if (severity === null) next.severity = "Choose a severity"
      if (likelihood === null) next.likelihood = "Choose a likelihood"
      setErrors(next)
      return
    }

    setErrors({})
    startTransition(async () => {
      const result = await recordRiskReview(parsed.data)
      if (result.ok) {
        toast.success(`Review of "${risk.title}" saved for ${periodLabel}.`)
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-48px)] flex-col gap-0 p-0 sm:max-w-[660px]">
        <DialogHeader className="shrink-0 gap-1 border-b px-6 pt-5 pb-4 pr-12">
          <DialogTitle className="text-lg font-semibold">Quarterly review · {periodLabel}</DialogTitle>
          <DialogDescription className="truncate" title={risk.title}>
            {risk.processName} · {risk.title}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {closed && (
            <div className="mx-6 mt-5 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-900/20 dark:text-amber-300">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>
                {periodLabel} is closed. Reviews for this period can no longer be
                recorded or changed; contact an IMS admin if a correction is needed.
              </span>
            </div>
          )}

          {/* ── 1 · Score ── */}
          <section aria-labelledby="review-part-score" className="space-y-4 px-6 py-5">
            <h3 id="review-part-score" className={PART}>1 · Score now, with the treatment in place</h3>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
              <div className="space-y-3">
                <RatingButtons
                  id="review-severity"
                  label="Severity"
                  value={severity}
                  onChange={edit("severity", setSeverity)}
                  error={errors.severity}
                  disabled={locked}
                />
                <RatingButtons
                  id="review-likelihood"
                  label="Likelihood"
                  value={likelihood}
                  onChange={edit("likelihood", setLikelihood)}
                  error={errors.likelihood}
                  disabled={locked}
                />
              </div>

              <div
                aria-live="polite"
                className="flex-1 space-y-2.5 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-4xl font-bold leading-none tabular-nums">{rpn ?? "—"}</span>
                  {rpn !== null ? (
                    <span className={`${PILL} ${RISK_BAND_PILL[band]}`}>{RISK_BAND_LABEL[band]}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">Pick both to see the band</span>
                  )}
                </div>
                {(context?.baseline != null || context?.previous) && (
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {context.baseline != null && (
                      <li>Baseline (before treatment): {scoreText(context.baseline)}</li>
                    )}
                    {context.previous && (
                      <li>{context.previous.period}: {scoreText(context.previous.rpn)}</li>
                    )}
                  </ul>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="review-notes">Notes <Optional /></Label>
              <GrowingTextarea
                id="review-notes"
                rows={2}
                className={textareaClass}
                placeholder="What changed since the last rating…"
                value={notes}
                disabled={locked}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </section>

          {/* ── 2 · Treatment ── */}
          {treatment && (
            <section aria-labelledby="review-part-treatment" className="space-y-4 border-t px-6 py-5">
              <h3 id="review-part-treatment" className={PART}>2 · Is the treatment working?</h3>

              <div className="flex flex-col gap-2 rounded-lg border border-slate-200 px-3.5 py-3 dark:border-slate-800 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                <p className="text-sm whitespace-pre-line">{treatment.solution}</p>
                <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
                  <span className={`${PILL} ${TREATMENT_STATUS[treatment.status]}`}>
                    {TREATMENT_STATUS_LABEL[treatment.status]}
                  </span>
                  {treatment.targetDate && (
                    <span className="text-xs text-muted-foreground">Target {fmtDate(treatment.targetDate)}</span>
                  )}
                </div>
              </div>

              <EffectivenessCards
                value={effectiveness}
                onChange={edit("effectiveness", setEffectiveness)}
                disabled={locked}
                error={errors.effectiveness}
              />

              <div className="space-y-2">
                <Label htmlFor="review-evidence">Solution evidence <Optional /></Label>
                <GrowingTextarea
                  id="review-evidence"
                  rows={2}
                  className={textareaClass}
                  placeholder="What shows the treatment ran this quarter, e.g. a report"
                  value={solutionEvidence}
                  disabled={locked}
                  onChange={(e) => setSolutionEvidence(e.target.value)}
                />
              </div>

              {deviating && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="review-reason">Reason for deviation <Req /></Label>
                    <GrowingTextarea
                      id="review-reason"
                      rows={3}
                      className={textareaClass}
                      placeholder="Why it isn't going to plan"
                      value={reasonForDeviation}
                      disabled={locked}
                      onChange={(e) => edit("reasonForDeviation", setReasonForDeviation)(e.target.value)}
                      aria-invalid={errors.reasonForDeviation ? true : undefined}
                      aria-describedby={errors.reasonForDeviation ? "review-reasonForDeviation-error" : undefined}
                    />
                    <FieldError id="review-reasonForDeviation-error" message={errors.reasonForDeviation} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="review-followup">Follow-up measure <Req /></Label>
                    <GrowingTextarea
                      id="review-followup"
                      rows={3}
                      className={textareaClass}
                      placeholder="What will be done about it"
                      value={followupMeasure}
                      disabled={locked}
                      onChange={(e) => edit("followupMeasure", setFollowupMeasure)(e.target.value)}
                      aria-invalid={errors.followupMeasure ? true : undefined}
                      aria-describedby={errors.followupMeasure ? "review-followupMeasure-error" : undefined}
                    />
                    <FieldError id="review-followupMeasure-error" message={errors.followupMeasure} />
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="m-0 shrink-0 flex-row items-center justify-between gap-3 px-6 py-3.5 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {closed
              ? null
              : treatment
                ? "Saves the score and the review together"
                : "This risk has no treatment to review; saves the score only"}
          </span>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>
              {closed ? "Close" : "Cancel"}
            </Button>
            {!closed && (
              <Button onClick={handleSave} disabled={pending}>
                {pending ? "Saving…" : "Save review"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
