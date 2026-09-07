"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { AlertTriangle } from "lucide-react"
import { mockRisks } from "@/lib/mockData"

export function RiskMatrix({ period }: { period?: string }) {
  // If a period is passed, filter the risks, otherwise show all
  const risks = period ? mockRisks.filter(r => r.period === period) : mockRisks

  const getRiskCount = (likelihood: number, severity: number) => {
    return risks.filter(r => r.likelihood === likelihood && r.severity === severity).length
  }

  // To build a 5x5 matrix
  const levels = [5, 4, 3, 2, 1]

  const getCellColor = (l: number, s: number) => {
    const score = l * s
    if (score >= 15) return "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400"
    if (score >= 5) return "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400"
    return "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400"
  }

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
        </div>
      </CardContent>
    </Card>
  )
}
