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
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Risk Heatmap</CardTitle>
        <CardDescription>Distribution of active risks by Severity and Likelihood</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 items-center justify-center p-4">
          
          {/* ── Matrix Area ── */}
          <div className="relative">
            {/* Y-Axis Main Label */}
            <div className="absolute -left-10 md:-left-16 top-1/2 -translate-y-1/2 -rotate-90 text-sm font-semibold text-muted-foreground whitespace-nowrap tracking-wider">
              Likelihood
            </div>
            
            <div className="flex flex-col">
              {/* Rows (5 down to 1) */}
              {[5, 4, 3, 2, 1].map((likelihood) => (
                <div key={`row-${likelihood}`} className="flex items-center">
                  <div className="w-20 md:w-24 pr-4 text-right text-[10px] md:text-xs font-medium text-muted-foreground leading-tight">
                    {LIKELIHOOD_LABELS[likelihood - 1]}
                  </div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((severity) => {
                      const count = mockRiskCounts[`${severity},${likelihood}`] || 0
                      const bgColor = getRiskColor(severity, likelihood)
                      const textColor = getRiskTextColor(severity, likelihood)
                      
                      return (
                        <div
                          key={`cell-${severity}-${likelihood}`}
                          className={`w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 xl:w-16 xl:h-16 border border-white/30 dark:border-zinc-950/30 flex items-center justify-center cursor-pointer transition-all shadow-[inset_0_0_8px_rgba(0,0,0,0.1)] ${bgColor}`}
                          title={`Severity: ${SEVERITY_LABELS[severity - 1]}\nLikelihood: ${LIKELIHOOD_LABELS[likelihood - 1]}\nRisks: ${count}`}
                        >
                          {count > 0 ? (
                            <span className={`text-base sm:text-lg xl:text-xl font-bold ${textColor} drop-shadow-sm`}>
                              {count}
                            </span>
                          ) : (
                            <span className="text-black/10 dark:text-white/10 font-bold select-none">-</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
              
              {/* X-Axis Labels */}
              <div className="flex mt-3 pl-20 md:pl-24">
                {[1, 2, 3, 4, 5].map((severity) => (
                  <div key={`col-label-${severity}`} className="w-12 sm:w-16 md:w-20 text-center text-[10px] md:text-xs font-medium text-muted-foreground px-1 break-words leading-tight">
                    {SEVERITY_LABELS[severity - 1]}
                  </div>
                ))}
              </div>
            </div>
            
            {/* X-Axis Main Label */}
            <div className="text-center text-sm font-semibold text-muted-foreground mt-4 ml-20 md:ml-24 tracking-wider">
              Severity / Impact
            </div>
          </div>
          
          {/* ── Legend ── */}
          <div className="flex flex-col gap-4 p-5 rounded-xl bg-slate-50 dark:bg-slate-900 border min-w-[200px]">
            <h4 className="font-semibold text-sm tracking-tight">Risk Rating (RPN)</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-5 h-5 rounded-md bg-rose-500 shadow-sm border border-rose-600/20" />
                <span>High (15-25)</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-5 h-5 rounded-md bg-amber-400 shadow-sm border border-amber-500/20" />
                <span>Medium (5-12)</span>
              </div>
              <div className="flex items-center gap-3 text-sm font-medium">
                <div className="w-5 h-5 rounded-md bg-emerald-500 shadow-sm border border-emerald-600/20" />
                <span>Low (1-4)</span>
              </div>
            </div>
          </div>
          
        </div>
      </CardContent>
    </Card>
  )
}
