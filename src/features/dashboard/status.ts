import type { Enums } from "@/types/database";
import type { ScoredRiskBand } from "@/features/risks/scoring";

/**
 * The dashboard's status colours, on the calmer --status-* tokens.
 *
 * Dashboard only, for now: the rest of the app still reads the emerald /
 * rose / amber maps in components/shared/status-styles.ts, and moves over
 * in a later batch. Every map here keys on the same statuses and bands as
 * its counterpart there, so the meaning of a colour does not change — only
 * the shade. The shape rules still hold: Pending is a dashed outline, Not
 * Measured a filled pill.
 */

/** Pill tones: the token at 15% behind the token darkened into ink. */
export const DASH_TONE = {
  good: "bg-status-good/15 text-status-good-ink border-transparent",
  warn: "bg-status-warn/15 text-status-warn-ink border-transparent",
  bad: "bg-status-bad/15 text-status-bad-ink border-transparent",
  /** Not measured: filled, ink at 30% as a ground. */
  neutral: "bg-status-neutral/40 text-ink border-transparent",
  /** Nothing recorded yet: dashed outline, no fill. */
  pending: "bg-transparent border-dashed border-status-neutral text-ink-2",
  /** In hand: ink's own tint, as before. */
  inHand: "bg-ink/5 text-ink border-transparent",
  /** Withdrawn / historical: dashed and quiet, as before. */
  retired: "bg-transparent border-dashed border-status-neutral text-muted-foreground",
} as const;

export type DashTone = keyof typeof DASH_TONE;

/** v_open_action_items statuses — OPEN_WORK_STATUS's keys and meanings. */
export const DASH_OPEN_WORK_STATUS: Record<string, string> = {
  open: DASH_TONE.pending,
  not_started: DASH_TONE.pending,
  planned: DASH_TONE.pending,
  in_progress: DASH_TONE.inHand,
  blocked: DASH_TONE.bad,
  completed: DASH_TONE.good,
  cancelled: DASH_TONE.retired,
};

/** Quarter sign-off — SIGNOFF_STATUS's keys and meanings. */
export const DASH_SIGNOFF_STATUS: Record<Enums<"signoff_status">, string> = {
  open: DASH_TONE.pending,
  submitted: DASH_TONE.inHand,
  returned: DASH_TONE.bad,
  approved: DASH_TONE.inHand,
  received: DASH_TONE.good,
};

/**
 * Company heatmap cells — HEATMAP_CELL's bands. `neutral` is still "no
 * verdict": no fill at all, never a colour.
 */
export const DASH_HEATMAP_CELL: Record<"good" | "warn" | "bad" | "neutral", string> = {
  good: "bg-status-good/15 text-status-good-ink",
  warn: "bg-status-warn/15 text-status-warn-ink",
  bad: "bg-status-bad/15 text-status-bad-ink",
  neutral: "text-muted-foreground",
};

/**
 * Company risk map squares, by band — RISK_MAP_CELL's shape. Filled
 * squares carry the solid token with whichever of ink or white reads
 * better on it (5.2:1 sage, 6.9:1 ochre, 4.7:1 brick); empty ones the
 * band's faint ground.
 */
export const DASH_RISK_MAP_CELL: Record<ScoredRiskBand, { filled: string; empty: string }> = {
  low: { filled: "bg-status-good text-ink", empty: "bg-status-good/10" },
  medium: { filled: "bg-status-warn text-ink", empty: "bg-status-warn/10" },
  critical: { filled: "bg-status-bad text-white", empty: "bg-status-bad/10" },
};

export const DASH_RISK_MAP_SWATCH: Record<ScoredRiskBand, string> = {
  low: "bg-status-good",
  medium: "bg-status-warn",
  critical: "bg-status-bad",
};

/** Chart series colours for statuses, as CSS values for Recharts. */
export const DASH_CHART = {
  good: "var(--status-good)",
  bad: "var(--status-bad)",
  neutral: "var(--status-neutral)",
  pending: "var(--status-pending)",
} as const;
