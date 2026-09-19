/**
 * One place for how a status looks.
 *
 * Every list, card, detail page and chart imports from here, so a colour
 * carries one meaning across the app: emerald is "achieved", rose is
 * "deviated" or "critical", and neither is ever also "open". Two rules the
 * shapes enforce, not just the shades:
 *
 *  - Pending (nothing recorded yet) is a dashed outline; Not Measured (a
 *    recorded N/A) is a filled grey pill. They must never look alike — Not
 *    Measured exists as its own status precisely so a recorded N/A does not
 *    read as awaiting entry.
 *  - A risk score is a fixed-width rounded square holding the number, not a
 *    pill, so "critical 20" never reads as a deviated KPI.
 *
 * Banding still comes from riskBand() in features/risks/scoring.ts; these
 * maps only decide presentation for a band the caller already has.
 */
import type { KpiStatus } from "@/features/kpis/types"
import type { ObjectiveOutcome, ObjectiveLifecycle } from "@/features/objectives/queries"
import type { RiskBand } from "@/features/risks/scoring"
import type { RiskStatus } from "@/components/forms/RiskForm"
import type { Enums } from "@/types/database"

/** Base classes for a status pill. Combine with one of the maps below. */
export const PILL =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"

const ACHIEVED = "bg-emerald-50 text-emerald-700 border-emerald-200"
const DEVIATED = "bg-rose-50 text-rose-700 border-rose-200"
/** Nothing recorded yet: dashed outline, no fill. */
const PENDING = "bg-transparent border-dashed border-slate-300 text-slate-500"
/** A recorded N/A: filled, no border. A different shape from Pending. */
const NOT_MEASURED = "bg-slate-100 text-slate-600 border-transparent"
/** The neutral "in hand" tint — ink at 5%, never a second accent colour. */
const INK_TINT = "bg-ink/5 text-ink border-transparent"
/** Withdrawn / historical: dashed and quiet. */
const RETIRED = "bg-transparent border-dashed border-slate-300 text-slate-400"
/** A lifecycle fact, not a severity: neutral outline. */
const NEUTRAL = "bg-transparent border-slate-300 text-slate-700"

export const KPI_STATUS: Record<KpiStatus, string> = {
  Achieved: ACHIEVED,
  Deviated: DEVIATED,
  Pending: PENDING,
  "Not Measured": NOT_MEASURED,
}

export const OBJECTIVE_OUTCOME: Record<ObjectiveOutcome, string> = {
  measured: INK_TINT,
  not_reported: PENDING,
  completed_earlier: ACHIEVED,
  not_measured: NOT_MEASURED,
}

/** Active / Achieved / Retired — the objective's own state, not a score. */
export const OBJECTIVE_LIFECYCLE: Record<ObjectiveLifecycle, string> = {
  Active: NEUTRAL,
  Achieved: ACHIEVED,
  Retired: RETIRED,
}

/** Open / Mitigating / Closed / Retired — status is not severity. */
export const RISK_STATUS: Record<RiskStatus, string> = {
  Open: NEUTRAL,
  Mitigating: NEUTRAL,
  Closed: NEUTRAL,
  Retired: RETIRED,
}

export const TREATMENT_STATUS: Record<Enums<"treatment_status">, string> = {
  planned: PENDING,
  in_progress: INK_TINT,
  completed: ACHIEVED,
  cancelled: RETIRED,
}

export const ACTION_STATUS: Record<Enums<"action_status">, string> = {
  open: PENDING,
  in_progress: INK_TINT,
  blocked: DEVIATED,
  completed: ACHIEVED,
  cancelled: RETIRED,
}

/** Base classes for the score square. Combine with RISK_SCORE[band]. */
export const SCORE =
  "inline-flex h-7 w-9 items-center justify-center rounded-md border text-xs font-semibold tabular-nums"

export const RISK_SCORE: Record<RiskBand, string> = {
  critical: "bg-rose-600 text-white border-rose-600",
  medium: "bg-amber-100 text-amber-800 border-amber-100",
  low: "bg-emerald-100 text-emerald-800 border-emerald-100",
  not_assessed: "bg-transparent border-dashed border-slate-300 text-slate-400",
}

/** Band as a count chip (dashboard card), same colours as the square. */
export const RISK_BAND_PILL: Record<RiskBand, string> = {
  critical: "bg-rose-600 text-white border-rose-600",
  medium: "bg-amber-100 text-amber-800 border-amber-100",
  low: "bg-emerald-100 text-emerald-800 border-emerald-100",
  not_assessed: PENDING,
}

/**
 * Chart series colours. Tailwind's own hex values so the bars match the
 * pills: emerald-500, rose-500, slate-200, slate-400; ink for any series
 * that used to be blue.
 */
export const CHART = {
  achieved: "#10b981",
  deviated: "#f43f5e",
  pending: "#e2e8f0",
  notMeasured: "#94a3b8",
  ink: "#1A1A2E",
  total: "#94a3b8",
  /** Pre-treatment score series: slate-400, dashed, so it reads as "before". */
  baseline: "#94a3b8",
} as const
