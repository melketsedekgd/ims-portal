/**
 * The dashboard's shared chart styling. The two quarterly count charts that
 * lived here were replaced by the objectives and process health cards;
 * Risk scores and the company overview still draw with these.
 */

/**
 * One height for every chart area on the dashboard so the three cards in
 * the row line up. RiskScoreTrend uses it too; its footnote sits inside
 * this box rather than under it, so that card never grows past the others.
 */
export const DASHBOARD_CHART_AREA = "h-[260px]"

/**
 * Axes and gridlines in ink, light and thin, for every dashboard chart.
 * The tick colour needs `!`: ChartContainer already sets the same selector
 * to muted-foreground and the two would otherwise tie. The grid sets its
 * own stroke, which also takes it out of ChartContainer's #ccc override.
 */
export const DASHBOARD_CHART_AXES = "[&_.recharts-cartesian-axis-tick_text]:fill-ink-2!"
export const DASHBOARD_CHART_GRID = {
  stroke: "var(--ink)",
  strokeOpacity: 0.08,
  strokeWidth: 1,
} as const

/** Tooltips: a white card, 12px radius, soft shadow, no border. */
export const DASHBOARD_TOOLTIP =
  "rounded-[12px] border-0 bg-white px-3 py-2 shadow-[0_8px_24px_rgba(20,23,31,0.12)]"

/** The primary series colour: coral, from the token rather than a hex. */
export const DASHBOARD_CHART_PRIMARY = "var(--coral)"
