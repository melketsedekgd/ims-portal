"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ShieldAlert, Lock, ChevronDown, ChevronRight, SquarePen } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type { RiskStatus } from "@/components/forms/RiskForm"
import type { RiskListItem } from "@/features/risks/queries"
import type { PeriodEntryState } from "@/features/periods/queries"
import { riskBand, RISK_BAND_LABEL, type ScoredRiskBand } from "@/features/risks/scoring"
import AssessmentDialog from "@/features/risks/components/AssessmentDialog"

// ── Score Helpers ──

// Thresholds live in features/risks/scoring.ts so the register and the period
// snapshot band identically. Only the presentation is decided here, and only
// for the bands that carry a score — "not assessed" is not a severity.
const BAND_STYLE: Record<ScoredRiskBand, { bg: string; text: string }> = {
  critical: { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-800 dark:text-rose-400" },
  medium: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-800 dark:text-amber-400" },
  low: { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-800 dark:text-emerald-400" },
}

// A risk with no residual assessment in the selected period has no score.
// Rendering that as 0 would read as "0 · Low", which is a different and false
// claim, so it gets a neutral badge outside the severity scale.
function ScoreBadge({ score }: { score: number | null }) {
  const band = riskBand(score)
  if (score === null || band === "not_assessed") {
    return (
      <Badge variant="outline" className="text-muted-foreground font-medium border-dashed">
        {RISK_BAND_LABEL.not_assessed}
      </Badge>
    )
  }
  const style = BAND_STYLE[band]
  return (
    <Badge className={`${style.bg} ${style.text} hover:${style.bg} font-semibold tabular-nums`}>
      {score} · {RISK_BAND_LABEL[band]}
    </Badge>
  )
}

function StatusBadge({ status }: { status: RiskStatus }) {
  switch (status) {
    case "Open":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Open</Badge>
    case "Mitigating":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400">Mitigating</Badge>
    case "Closed":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Closed</Badge>
    // Withdrawn from the register, not resolved. Neutral rather than emerald so
    // it doesn't read as an achievement, and distinct from Closed so a reader
    // of a historical quarter can tell the two apart.
    case "Retired":
      return <Badge variant="outline" className="text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700">Retired</Badge>
  }
}

export default function RiskRegister({
  initialData,
  year,
  quarter,
  period,
}: {
  initialData: RiskListItem[]
  year: string
  quarter: string
  /** null when the URL names a quarter that has no reporting_periods row. */
  period: PeriodEntryState | null
}) {
  const router = useRouter()
  // Read from props, not copied into state: after a rating is saved the
  // server action revalidates this route and new rows arrive as props, and
  // the instance is reused (same period, same key), so a useState(initialData)
  // copy would keep showing the pre-save scores.
  const data = initialData
  const [assessing, setAssessing] = useState<RiskListItem | null>(null)

  // URL-driven state updates
  const setPeriod = (next: { year?: string; quarter?: string }) => {
    const params = new URLSearchParams({
      year: next.year ?? year,
      quarter: next.quarter ?? quarter,
    })
    router.push(`?${params.toString()}`)
  }

  // Closed risks are resolved; retired ones are historical. Neither is editable
  // from the register.
  const isLocked = (risk: RiskListItem) =>
    risk.status === "Closed" || risk.status === "Retired"

  // Collapsible process groups
  const [collapsedProcesses, setCollapsedProcesses] = useState<Set<string>>(new Set())

  const toggleProcess = (processName: string) => {
    setCollapsedProcesses(prev => {
      const next = new Set(prev)
      if (next.has(processName)) {
        next.delete(processName)
      } else {
        next.add(processName)
      }
      return next
    })
  }

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-600" />
            <h1 className="text-2xl font-bold tracking-tight">Risk Register</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Identify, assess, and track risks that threaten departmental objectives.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ── Period Picker ── */}
          <Select value={quarter} onValueChange={(v) => v && setPeriod({ quarter: v })}>
            <SelectTrigger className="w-[80px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Q1","Q2","Q3","Q4"].map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={(v) => v && setPeriod({ year: v })}>
            <SelectTrigger className="w-[90px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {/* No "Log Risk" entrance until createRisk lands — a risk also
              needs a baseline assessment, which is its own brief. */}
        </div>
      </div>

      {/* ── Risk Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Risk</TableHead>
              <TableHead className="h-10 w-[80px] text-center">L × S</TableHead>
              <TableHead className="h-10">Score</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10 w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const groups = data.reduce<Record<string, RiskListItem[]>>((acc, risk) => {
                const key = risk.processName || "General"
                if (!acc[key]) acc[key] = []
                acc[key].push(risk)
                return acc
              }, {})

              return Object.entries(groups).flatMap(([processName, risks]) => {
                const isCollapsed = collapsedProcesses.has(processName)
                return [
                  // ── Process Section Header Row ──
                  <TableRow
                    key={`group-${processName}`}
                    className="bg-slate-50/80 dark:bg-zinc-900/60 hover:bg-slate-100/80 dark:hover:bg-zinc-900/80 cursor-pointer select-none"
                    onClick={() => toggleProcess(processName)}
                  >
                    <TableCell colSpan={5} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        }
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                          {processName}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-zinc-500 ml-1">
                          ({risks.length} {risks.length === 1 ? "risk" : "risks"})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed ? risks.map((row) => {
                    const locked = isLocked(row)
                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => router.push(`/department/risks/${row.id}?year=${year}&quarter=${quarter}`)}
                        className={`transition-colors cursor-pointer ${locked ? "bg-slate-50/60 dark:bg-zinc-900/30 hover:bg-slate-100/60 dark:hover:bg-zinc-900/50 opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}`}
                      >
                        <TableCell className="font-medium max-w-[280px] pl-6">
                          <div className="flex items-center gap-2 truncate" title={row.title}>
                            {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                            <span className="truncate">{row.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {row.likelihood === null || row.severity === null
                              ? "—"
                              : `${row.likelihood} × ${row.severity}`}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ScoreBadge score={row.riskScore} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {period && !locked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 transition-colors z-10 relative"
                                title={period.status === "closed" ? `${quarter} ${year} is closed` : "Rate residual risk"}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAssessing(row)
                                }}
                              >
                                {period.status === "closed"
                                  ? <Lock className="h-4 w-4" />
                                  : <SquarePen className="h-4 w-4" />}
                              </Button>
                            )}
                            {locked && (
                              <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 font-medium px-1">
                                <Lock className="h-3 w-3" />
                                <span>{row.status}</span>
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  }) : [])
                ]
              })
            })()}
          </TableBody>
        </Table>
      </div>

      {assessing && period && (
        <AssessmentDialog
          key={assessing.id}
          risk={assessing}
          period={period}
          periodLabel={`${quarter} ${year}`}
          onClose={() => setAssessing(null)}
        />
      )}
    </div>
  )
}
