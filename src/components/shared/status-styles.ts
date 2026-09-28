/**
 * One place for how a status looks.
 *
 * Every list, card, detail page and chart imports from here, so a colour
 * carries one meaning across the app. The colours are the --status-*
 * tokens in globals.css: good ("achieved"), bad ("deviated", "critical"),
 * warn ("medium"), neutral (ink at 30%, a recorded N/A) and pending (ink at
 * 8%, nothing yet). Pill text uses the -ink variant of its token, which
 * holds 4.5:1 or better on the token's own 15% tint. Two rules the shapes
 * enforce, not just the shades:
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
import type { RiskBand, ScoredRiskBand } from "@/features/risks/scoring"
import type { RiskStatus } from "@/components/forms/RiskForm"
import type { Enums } from "@/types/database"

/** Base classes for a status pill. Combine with one of the maps below. */
export const PILL =
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap"

const ACHIEVED = "bg-status-good/15 text-status-good-ink border-transparent"
const DEVIATED = "bg-status-bad/15 text-status-bad-ink border-transparent"
/** Nothing recorded yet: dashed outline, no fill. */
const PENDING = "bg-transparent border-dashed border-status-neutral text-ink-2"
/** A recorded N/A: filled, no border. A different shape from Pending, and never bad. */
const NOT_MEASURED = "bg-status-neutral/40 text-ink border-transparent"
/** The neutral "in hand" tint — ink at 5%, never a second accent colour. */
const INK_TINT = "bg-ink/5 text-ink border-transparent"
/** Withdrawn / historical: dashed and quiet. */
const RETIRED = "bg-transparent border-dashed border-status-neutral text-muted-foreground"
/** A lifecycle fact, not a severity: neutral outline. */
const NEUTRAL = "bg-transparent border-status-neutral text-ink-2"

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

/**
 * v_open_action_items unions three tables with three different status
 * enums (action_status, treatment_status, activity_status) cast to text,
 * so this is keyed by every string value any of them can produce rather
 * than one enum's Record.
 */
export const OPEN_WORK_STATUS: Record<string, string> = {
  open: PENDING,
  not_started: PENDING,
  planned: PENDING,
  in_progress: INK_TINT,
  blocked: DEVIATED,
  completed: ACHIEVED,
  cancelled: RETIRED,
}

/**
 * Quarter sign-off. Open is Pending's dashed outline — nothing recorded yet —
 * and Returned is the only one that reads as a problem, because it is the only
 * one asking someone to go back and change something. Submitted and Approved
 * are both "in hand"; Received is the end of the paper trail, so it gets the
 * same good token as any other completed thing.
 */
export const SIGNOFF_STATUS: Record<Enums<"signoff_status">, string> = {
  open: PENDING,
  submitted: INK_TINT,
  returned: DEVIATED,
  approved: INK_TINT,
  received: ACHIEVED,
}

export const SIGNOFF_STATUS_LABEL: Record<Enums<"signoff_status">, string> = {
  open: "Open",
  submitted: "Submitted",
  returned: "Returned",
  approved: "Approved",
  received: "Received",
}

/**
 * Sign-off buttons.
 *
 * Not pills: these are the only controls on the page that change the state
 * of the quarter, so they read as buttons — white card, normal foreground
 * text — and carry their meaning in the border alone. Returning is the one
 * that sends work back, so it takes the bad token's border; submitting,
 * approving and receiving all move the quarter forward, so they share the
 * good token's. The hover tint is the token at 10%, lighter than a pill's
 * 15% so a hovered button never reads as a badge.
 *
 * Combine with <Button variant="outline">, which supplies the border
 * itself, the radius and the focus ring.
 */
export const SIGNOFF_ACTION = {
  danger:
    "bg-white text-foreground border-status-bad hover:bg-status-bad/10 hover:text-foreground dark:bg-card",
  success:
    "bg-white text-foreground border-status-good hover:bg-status-good/10 hover:text-foreground dark:bg-card",
} as const

/**
 * Heatmap cells on the company overview.
 *
 * The same good / bad tokens the badges carry, plus warn for "in hand,
 * needs watching", each as the token's 15% tint under its -ink text.
 *
 * `neutral` is not a fourth severity. It means the cell has no verdict to
 * give: nothing was measured, or a risk count cannot be trusted because
 * some risks were never assessed. Colouring those would turn "we do not
 * know" into "this is fine", which is the one reading a heatmap must never
 * produce. The thresholds that pick between these live in
 * features/dashboard/heatmap.ts.
 */
export const HEATMAP_CELL: Record<"good" | "warn" | "bad" | "neutral", string> = {
  good: "bg-status-good/15 text-status-good-ink",
  warn: "bg-status-warn/15 text-status-warn-ink",
  bad: "bg-status-bad/15 text-status-bad-ink",
  neutral: "text-muted-foreground",
}

/** Base classes for the score square. Combine with RISK_SCORE[band]. */
export const SCORE =
  "inline-flex h-7 w-9 items-center justify-center rounded-md border text-xs font-semibold tabular-nums"

/**
 * Low → good, Medium → warn, Critical → bad; there is no High band. Critical
 * is the solid token under white (4.7:1); the others a 20% tint under the
 * token's -ink text, so critical still stands out from the two below it.
 */
export const RISK_SCORE: Record<RiskBand, string> = {
  critical: "bg-status-bad text-white border-status-bad",
  medium: "bg-status-warn/20 text-status-warn-ink border-transparent",
  low: "bg-status-good/20 text-status-good-ink border-transparent",
  not_assessed: PENDING,
}

/**
 * Risk Register map cells, by the band of the cell's own L × S — not of
 * the risks in it, which are the same thing. `filled` holds at least one
 * risk and shows the count; `empty` is the band's faint ground, so the
 * shape of the bands still reads where nothing sits. Filled squares carry
 * the solid token with whichever of ink or white reads better on it: ink on
 * sage (5.2:1) and ochre (6.9:1), white on brick (4.7:1).
 */
export const RISK_MAP_CELL: Record<ScoredRiskBand, { filled: string; empty: string }> = {
  critical: { filled: "bg-status-bad text-white", empty: "bg-status-bad/10" },
  medium: { filled: "bg-status-warn text-ink", empty: "bg-status-warn/10" },
  low: { filled: "bg-status-good text-ink", empty: "bg-status-good/10" },
}

/** The legend swatch for a band: the filled cell's colour. */
export const RISK_MAP_SWATCH: Record<ScoredRiskBand, string> = {
  critical: "bg-status-bad",
  medium: "bg-status-warn",
  low: "bg-status-good",
}

/** Band as a count chip (dashboard card), same colours as the square. */
export const RISK_BAND_PILL: Record<RiskBand, string> = RISK_SCORE

/**
 * Chart series colours, as CSS values for SVG: the status tokens so the
 * bars match the pills, slate greys for series that are not a status, ink
 * for any series that used to be blue.
 */
export const CHART = {
  achieved: "var(--status-good)",
  deviated: "var(--status-bad)",
  pending: "var(--status-pending)",
  notMeasured: "var(--status-neutral)",
  ink: "#1A1A2E",
  total: "#94a3b8",
  /** Pre-treatment score series: slate-400, dashed, so it reads as "before". */
  baseline: "#94a3b8",
} as const
