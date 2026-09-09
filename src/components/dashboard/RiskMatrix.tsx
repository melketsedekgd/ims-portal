"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { riskBand, type RiskBand } from "@/features/risks/scoring"
import type { RiskListItem } from "@/features/risks/queries"

export function RiskMatrix({ risks }: { risks: RiskListItem[] }) {
  // Only scored risks can sit on the grid. A risk with no residual assessment
  // this period has no cell — it is counted underneath instead, so it does not
  // silently vanish from the page.
  const notAssessed = risks.filter(r => r.likelihood === null || r.severity === null).length

  const getRiskCount = (likelihood: number, severity: number) => {
    return risks.filter(r => r.likelihood === likelihood && r.severity === severity).length
  }

  // To build a 5x5 matrix
  const levels = [5, 4, 3, 2, 1]

  // Bands the cell's own coordinates, not a risk, so not_assessed is
  // unreachable here — l * s is always a number. It is still mapped so the
  // record stays exhaustive over RiskBand.
  const BAND_CELL: Record<RiskBand, string> = {
    critical: "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400",
    medium: "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400",
    low: "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400",
    not_assessed: "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400",
  }

  const getCellColor = (l: number, s: number) => BAND_CELL[riskBand(l * s)]

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Risk Heatmap
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-center">
        <div className="relative pt-4 pl-4">
          {/* Y-axis label */}
          <div className="absolute -left-2 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
            Likelihood
          </div>
          
          <div className="grid grid-cols-5 gap-1 h-[200px]">
            {levels.map((likelihood) => (
              levels.slice().reverse().map((severity) => {
                const count = getRiskCount(likelihood, severity)
                const color = getCellColor(likelihood, severity)
                const hasRisks = count > 0

                return (
                  <div
                    key={`${likelihood}-${severity}`}
                    className={`rounded-sm flex items-center justify-center text-xs font-bold transition-all ${
                      hasRisks 
                        ? `${color} ring-1 ring-inset ring-black/5 dark:ring-white/5` 
                        : "bg-slate-50 dark:bg-zinc-900/50 text-transparent"
                    }`}
                    title={`L:${likelihood} × S:${severity} = Score:${likelihood * severity}`}
                  >
                    {hasRisks ? count : ""}
                  </div>
                )
              })
            ))}
          </div>

          {/* X-axis label */}
          <div className="text-center text-[10px] font-medium text-muted-foreground tracking-wider uppercase mt-2">
            Severity
          </div>

          {notAssessed > 0 && (
            <p className="text-center text-[11px] text-muted-foreground mt-3">
              <span className="tabular-nums font-medium">{notAssessed}</span>{" "}
              {notAssessed === 1 ? "risk has" : "risks have"} no assessment this
              period and {notAssessed === 1 ? "is" : "are"} not plotted.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
