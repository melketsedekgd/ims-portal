import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { riskBand, RISK_BAND_LABEL, type RiskBand } from "@/features/risks/scoring"
import { RISK_SCORE } from "@/components/shared/status-styles"
import type { RiskListItem } from "@/features/risks/queries"

/** rpn is severity × likelihood on 1–5 scales, so the track runs 0–25. */
const MAX = 25
/** riskBand() thresholds, drawn as guides so the bands are legible on the track. */
const GUIDES = [5, 15]
const MAX_ROWS = 12

const pct = (score: number) => `${(score / MAX) * 100}%`

// The residual dot takes the same classes as the register's score square,
// so a band is the same colour here and there. ring-current draws the
// outline in the band's text colour, which keeps the pale medium and low
// fills readable on the track.
const dot = (band: RiskBand) =>
  `h-3 w-3 rounded-full ring-2 ring-current ${RISK_SCORE[band]}`

/**
 * Baseline-to-residual for every risk scored this period.
 *
 * Answers "are treatments reducing residual risk?" directly: one row per
 * risk, hollow dot at the pre-treatment baseline, filled dot at this
 * period's residual, banded by riskBand(). Not a quarter-over-quarter line
 * on purpose — Q1's plotted risks are mostly different risks from Q2's, so
 * a line between quarters would draw a trend that is not there.
 */
export function RiskReduction({
  risks,
  year,
  quarter,
}: {
  /** Risks for the selected period, as the register lists them. */
  risks: RiskListItem[]
  year: string
  quarter: string
}) {
  // Only a residual score puts a risk on the track. A risk with none this
  // period is counted underneath rather than silently vanishing.
  const plotted = risks
    .filter((r): r is RiskListItem & { riskScore: number } => r.riskScore !== null)
    .sort(
      (a, b) =>
        b.riskScore - a.riskScore ||
        (b.baselineScore ?? -1) - (a.baselineScore ?? -1)
    )
  const unassessed = risks.length - plotted.length
  // Strictly below: an unchanged score is not a reduction.
  const below = plotted.filter(
    (r) => r.baselineScore !== null && r.riskScore < r.baselineScore
  ).length
  const shown = plotted.slice(0, MAX_ROWS)
  const registerHref = `/department/risks?year=${year}&quarter=${quarter}`

  const bandsPresent = new Set(plotted.map((r) => riskBand(r.riskScore)))

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle>Risk reduction</CardTitle>
        <CardDescription>
          {plotted.length > 0
            ? `${below} of ${plotted.length} ${plotted.length === 1 ? "risk" : "risks"} scored below ${plotted.length === 1 ? "its" : "their"} baseline`
            : `${quarter} ${year} — baseline to residual, per risk`}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-4">
        {plotted.length > 0 && (
          <ol className="space-y-1.5">
            {shown.map((r) => (
              <Row key={r.id} risk={r} />
            ))}
          </ol>
        )}

        {plotted.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-full border-2 border-slate-400 bg-white" />
              Baseline
            </span>
            {(["low", "medium", "critical"] as const)
              .filter((band) => band !== "critical" || bandsPresent.has("critical"))
              .map((band) => (
                <span key={band} className="inline-flex items-center gap-1.5">
                  <span className={dot(band)} />
                  Residual {RISK_BAND_LABEL[band].toLowerCase()}
                </span>
              ))}
          </div>
        )}

        {unassessed > 0 && (
          <p className="text-xs text-muted-foreground">
            {unassessed} {unassessed === 1 ? "risk has" : "risks have"} no assessment this period and{" "}
            {unassessed === 1 ? "is" : "are"} not plotted.
          </p>
        )}

        {(plotted.length > MAX_ROWS || plotted.length === 0) && (
          <Link
            href={registerHref}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            View all in the risk register
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

function Row({ risk }: { risk: RiskListItem & { riskScore: number } }) {
  const band = riskBand(risk.riskScore)
  const baseline = risk.baselineScore
  const hasLine = baseline !== null && baseline !== risk.riskScore
  const left = Math.min(baseline ?? risk.riskScore, risk.riskScore)
  const right = Math.max(baseline ?? risk.riskScore, risk.riskScore)

  return (
    <li
      tabIndex={0}
      className="group grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] items-center gap-3 rounded-md px-1 py-0.5 outline-none hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={`${risk.title}: baseline ${baseline ?? "not recorded"}, residual ${risk.riskScore}, ${RISK_BAND_LABEL[band]}`}
    >
      <span className="truncate text-xs text-slate-700" title={risk.title}>
        {risk.title}
      </span>

      {/* The 0–25 track. Guides mark the riskBand() thresholds. */}
      <span className="relative block h-5">
        {GUIDES.map((g) => (
          <span
            key={g}
            className="absolute top-0 bottom-0 border-l border-dashed border-slate-200"
            style={{ left: pct(g) }}
            aria-hidden
          />
        ))}
        {hasLine && (
          <span
            className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-slate-300"
            style={{ left: pct(left), width: pct(right - left) }}
            aria-hidden
          />
        )}
        {baseline !== null && (
          <span
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 h-3 w-3 rounded-full border-2 border-slate-400 bg-white"
            style={{ left: pct(baseline) }}
            aria-hidden
          />
        )}
        <span
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${dot(band)}`}
          style={{ left: pct(risk.riskScore) }}
          aria-hidden
        />
        {/* Values, shown on hover and focus only. No animation. */}
        <span className="pointer-events-none absolute -top-0.5 right-0 hidden text-[10px] leading-none text-slate-500 group-hover:block group-focus-visible:block">
          baseline {baseline ?? "—"} · residual {risk.riskScore}
        </span>
      </span>

      <span className="text-xs tabular-nums whitespace-nowrap">
        <span className="text-muted-foreground">{baseline ?? "—"}</span>
        <span className="text-muted-foreground"> → </span>
        <span className="font-semibold text-ink">{risk.riskScore}</span>
      </span>
    </li>
  )
}
