import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DASH_RISK_MAP_CELL, DASH_RISK_MAP_SWATCH } from "@/features/dashboard/status"
import { riskBand, type ScoredRiskBand } from "@/features/risks/scoring"
import {
  RiskMapLegend,
  SCALE,
  SEVERITY_ROWS,
} from "@/features/risks/components/RiskHeatMap"
import type { CompanyRiskMatrix } from "@/features/dashboard/queries"

const AXIS = "text-[11px] font-semibold tracking-wide text-ink-2"
const TICK = "text-xs text-ink-2 text-center tabular-nums"

const plural = (n: number) => `${n} ${n === 1 ? "risk" : "risks"}`

/**
 * Every active risk in the company by residual likelihood × severity, for
 * one quarter.
 *
 * Laid out and keyed exactly as the Risk Register's map — severity up the
 * page, likelihood across, colour by the square's own L × S through
 * riskBand() — so a square means the same thing on both screens and the
 * same risk sits in the same place on each. The shades are the dashboard's
 * status tokens; the bands and cut-offs are the register's.
 *
 * No colour without evidence: a square is only filled when a risk has a
 * residual score there this quarter. An empty square shows its band's
 * faint ground and no number, and a risk nobody reassessed is counted in
 * "of M" and on no square at all.
 *
 * Not clickable yet.
 */
export default function CompanyRiskMap({
  quarter,
  matrix,
}: {
  quarter: string
  matrix: CompanyRiskMatrix
}) {
  const counts = new Map(matrix.cells.map((c) => [`${c.likelihood}-${c.severity}`, c.count]))
  const none = matrix.scored === 0

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="font-semibold text-ink">Company risk map · {quarter}</CardTitle>
        <CardDescription>
          {matrix.scored} of {matrix.total} risks scored this quarter
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-4">
        <div className="relative">
          <div
            className={`flex gap-3 ${none ? "opacity-40" : ""}`}
            aria-hidden={none || undefined}
          >
            <div className="flex items-center">
              <span className={`${AXIS} [writing-mode:vertical-rl] rotate-180`}>SEVERITY →</span>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1.5">
              {SEVERITY_ROWS.map((severity) => (
                <div key={severity} className="grid grid-cols-[18px_repeat(5,1fr)] gap-1.5 items-center">
                  <span className={TICK}>{severity}</span>
                  {SCALE.map((likelihood) => {
                    const n = counts.get(`${likelihood}-${severity}`) ?? 0
                    const colours = DASH_RISK_MAP_CELL[riskBand(likelihood * severity) as ScoredRiskBand]
                    return (
                      <div
                        key={likelihood}
                        role="img"
                        aria-label={`Likelihood ${likelihood}, severity ${severity}: ${plural(n)}`}
                        className={`flex h-9 items-center justify-center rounded-[8px] border border-ink/5 ${
                          n > 0 ? colours.filled : `${colours.empty} opacity-60`
                        }`}
                      >
                        {n > 0 && <span className="text-[15px] font-bold tabular-nums">{n}</span>}
                      </div>
                    )
                  })}
                </div>
              ))}
              <div className="grid grid-cols-[18px_repeat(5,1fr)] gap-1.5">
                <span />
                {SCALE.map((l) => (
                  <span key={l} className={TICK}>{l}</span>
                ))}
              </div>
              <span className={`${AXIS} pl-[24px] text-center`}>LIKELIHOOD →</span>
            </div>
          </div>
          {none && (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-sm text-muted-foreground">No risks scored for this quarter yet</p>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2">
          <RiskMapLegend swatches={DASH_RISK_MAP_SWATCH} />
        </div>
      </CardContent>
    </Card>
  )
}
