import type { SparkPoint } from "@/features/kpis/queries"

const W = 64
const H = 22
const PAD = 3

/**
 * Four quarters of achievement as a small line, drawn in coral.
 *
 * A quarter with no ratio — N/A or nothing entered — is a gap: the line
 * breaks there rather than dropping to zero or bridging across. An open
 * quarter is provisional, as on the dashboard: a dashed segment into a
 * hollow point. Scale is 0 up to 100% or the highest ratio, whichever is
 * larger, so an over-achiever does not flatten everyone else's line.
 */
export default function KpiSparkline({ points }: { points: SparkPoint[] }) {
  if (points.length === 0 || points.every((p) => p.ratio === null)) {
    return <span className="inline-block w-16 text-center text-xs text-muted-foreground">—</span>
  }

  const max = Math.max(1, ...points.map((p) => p.ratio ?? 0))
  const step = points.length > 1 ? (W - PAD * 2) / (points.length - 1) : 0
  const xy = points.map((p, i) => ({
    ...p,
    x: PAD + i * step,
    y: p.ratio === null ? null : PAD + (1 - p.ratio / max) * (H - PAD * 2),
  }))

  // Consecutive measured pairs only: a null on either side breaks the line.
  const segments = xy.slice(1).flatMap((b, i) => {
    const a = xy[i]
    if (a.y === null || b.y === null) return []
    return [{ a, b, dashed: b.provisional }]
  })

  const summary = points
    .map((p) => `${p.label}: ${p.ratio === null ? "N/A" : `${Math.round(p.ratio * 100)}%`}${p.provisional ? " (provisional)" : ""}`)
    .join(", ")

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Trend: ${summary}`} className="shrink-0 overflow-visible">
      <title>{summary}</title>
      {segments.map(({ a, b, dashed }, i) => (
        <line
          key={i}
          x1={a.x}
          y1={a.y!}
          x2={b.x}
          y2={b.y!}
          stroke="var(--coral)"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeDasharray={dashed ? "3 3" : undefined}
        />
      ))}
      {xy.map((p, i) =>
        p.y === null ? null : (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.provisional ? 2.5 : i === xy.length - 1 ? 2.5 : 1.5}
            fill={p.provisional ? "var(--card)" : "var(--coral)"}
            stroke="var(--coral)"
            strokeWidth={p.provisional ? 1.5 : 0}
          />
        )
      )}
    </svg>
  )
}
