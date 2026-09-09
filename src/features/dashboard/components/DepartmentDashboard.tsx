"use client"

import { useRouter } from "next/navigation"
import { OverviewCards } from "@/components/dashboard/OverviewCards"
import { TrendCharts } from "@/components/dashboard/TrendCharts"
import { RiskMatrix } from "@/components/dashboard/RiskMatrix"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { PendingActions } from "@/components/dashboard/PendingActions"
import { Badge } from "@/components/ui/badge"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"
import type { RiskListItem } from "@/features/risks/queries"
import type { ActionItem } from "@/features/action-items/queries"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

export default function DepartmentDashboard({
  year,
  quarter,
  isLive,
  kpiSeries,
  objectiveSeries,
  risks,
  actionItems,
}: {
  year: string
  quarter: string
  /**
   * Whether the selected period is the current reporting period. Decided on
   * the server by comparing against getCurrentPeriod(), which resolves the
   * quarter from reporting_periods by date range. This component no longer
   * computes a quarter from the browser clock — that was a second source of
   * "now" that disagreed with every other page on a quarter boundary.
   */
  isLive: boolean
  /** Whole-year series, one entry per quarter that exists. */
  kpiSeries: QuarterKpiCounts[]
  objectiveSeries: QuarterObjectiveCounts[]
  /** Risks for the selected period only — the matrix and card are not a trend. */
  risks: RiskListItem[]
  /** Standing open work. Not period-scoped, so the picker does not touch it. */
  actionItems: ActionItem[]
}) {
  const router = useRouter()

  // The selected quarter's slice of the year series. Undefined when the
  // quarter has no reporting_periods row at all.
  const kpis = kpiSeries.find((q) => q.label === quarter)
  const objectives = objectiveSeries.find((q) => q.label === quarter)

  // URL-driven state updates
  const setPeriod = (next: { year?: string; quarter?: string }) => {
    const params = new URLSearchParams({
      year: next.year ?? year,
      quarter: next.quarter ?? quarter,
    })
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex-1 space-y-3 p-4 md:p-6 w-full">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Department Dashboard</h1>

            {/* Dynamic Status Badge */}
            {isLive ? (
              <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-semibold rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                Live
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-semibold rounded-full border-slate-300 bg-slate-100 text-slate-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-slate-300 shadow-sm">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-400 dark:bg-zinc-500"></span>
                </span>
                Historical
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Overview of objectives, KPIs, and risk registers for the selected period.
          </p>
        </div>

        {/* ── Global Period Picker ── */}
        <div className="flex items-center gap-2">
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
        </div>
      </div>

      {/* ── Dashboard Bento Grid ── */}

      {/* Row 1: The Quick Pulse (100% width) */}
      <div className="w-full">
        <OverviewCards kpis={kpis} objectives={objectives} risks={risks} />
      </div>

      {/* ── Dashboard Columns (Left 60% / Right 40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">

        {/* Left Column: Heavy Analytics & Activity */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <TrendCharts year={year} kpiSeries={kpiSeries} objectiveSeries={objectiveSeries} />
          <RecentActivity />
        </div>

        {/* Right Column: Risk & Pending Actions */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <RiskMatrix risks={risks} />
          <PendingActions items={actionItems} />
        </div>

      </div>

    </div>
  )
}
