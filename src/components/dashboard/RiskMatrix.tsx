"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

// Mock data: risk counts grouped by [severity, likelihood] on a 1-5 scale
const mockRiskCounts: Record<string, number> = {
  "1,1": 2, // Sev 1, Likelihood 1
  "2,1": 1,
  "3,2": 1,
  "4,3": 2,
  "5,4": 1,
  "3,5": 1,
}

const SEVERITY_LABELS = ["Negligible", "Minor", "Moderate", "Major", "Severe"]
const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"]

function getRiskColor(severity: number, likelihood: number) {
  const rpn = severity * likelihood
  if (rpn <= 4) return "bg-emerald-500 hover:bg-emerald-600"
  if (rpn <= 12) return "bg-amber-400 hover:bg-amber-500"
  return "bg-rose-500 hover:bg-rose-600"
}

function getRiskTextColor(severity: number, likelihood: number) {
  const rpn = severity * likelihood
  if (rpn <= 4) return "text-emerald-950"
  if (rpn <= 12) return "text-amber-950"
  return "text-rose-950"
}

export function RiskMatrix() {
  return (
    <Card>
      <CardHeader className="flex flex-col md:flex-row md:items-start justify-between pb-2 gap-4 space-y-0">
        <div className="flex flex-col space-y-1.5">
          <CardTitle>Risk Heatmap</CardTitle>
          <CardDescription>Distribution of active risks by Severity and Likelihood</CardDescription>
        </div>
        
        {/* Legend in Header */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[10px] sm:text-[11px] font-medium text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-[2px] bg-rose-500" />
            <span>High (15-25)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-[2px] bg-amber-400" />
            <span>Medium (5-12)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500" />
            <span>Low (1-4)</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Same height as ChartContainer in TrendCharts */}
        <div className="h-[300px] w-full flex flex-col items-center justify-center relative">
          
          {/* Matrix and Axes Wrapper */}
          <div className="flex flex-col items-center">
            <div className="flex h-[200px] sm:h-[230px]">
              {/* Y-Axis Labels */}
              <div className="w-16 sm:w-20 flex flex-col justify-around text-[9px] sm:text-[10px] font-medium text-muted-foreground text-right pr-2">
                {[5, 4, 3, 2, 1].map((likelihood) => (
                  <div key={`y-${likelihood}`} className="leading-tight">
                    {LIKELIHOOD_LABELS[likelihood - 1]}
                  </div>
                ))}
              </div>

              {/* The Square Grid */}
              <div className="h-full aspect-square flex flex-col shadow-[inset_0_0_8px_rgba(0,0,0,0.05)] border border-white/20 dark:border-zinc-900/50">
                {[5, 4, 3, 2, 1].map((likelihood) => (
                  <div key={`row-${likelihood}`} className="flex-1 flex">
                    {[1, 2, 3, 4, 5].map((severity) => {
                      const count = mockRiskCounts[`${severity},${likelihood}`] || 0
                      const bgColor = getRiskColor(severity, likelihood)
                      const textColor = getRiskTextColor(severity, likelihood)
                      
                      return (
                        <div
                          key={`cell-${severity}-${likelihood}`}
                          className={`flex-1 border border-white/30 dark:border-zinc-950/40 flex items-center justify-center cursor-pointer transition-all ${bgColor}`}
                          title={`Severity: ${SEVERITY_LABELS[severity - 1]}\nLikelihood: ${LIKELIHOOD_LABELS[likelihood - 1]}\nRisks: ${count}`}
                        >
                          {count > 0 ? (
                            <span className={`text-sm sm:text-base font-bold ${textColor} drop-shadow-sm`}>
                              {count}
                            </span>
                          ) : (
                            <span className="text-black/10 dark:text-white/10 font-bold select-none">-</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* X-Axis Labels */}
            <div className="flex w-[200px] sm:w-[230px] ml-16 sm:ml-20 mt-2">
              {[1, 2, 3, 4, 5].map((severity) => (
                <div key={`x-${severity}`} className="flex-1 text-center text-[9px] sm:text-[10px] font-medium text-muted-foreground px-0.5 leading-tight break-words">
                  {SEVERITY_LABELS[severity - 1]}
                </div>
              ))}
            </div>
          </div>

        </div>
      </CardContent>
    </Card>
  )
}
