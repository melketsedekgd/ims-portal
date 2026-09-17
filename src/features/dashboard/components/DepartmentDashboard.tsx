"use client"

import { useState } from "react"
import { FileBarChart } from "lucide-react"
import { Button } from "@/components/ui/button"
import SlideOutSheet from "@/components/shared/SlideOutSheet"
import PeriodSnapshotPanel from "@/features/reports/components/PeriodSnapshotPanel"
import type { PeriodSnapshot } from "@/features/reports/queries"
import { OverviewCards } from "@/components/dashboard/OverviewCards"
import { ObjectiveReportingChart, KpiPerformanceChart } from "@/components/dashboard/TrendCharts"
import { RiskScoreTrend } from "@/components/dashboard/RiskScoreTrend"
import { PendingActions } from "@/components/dashboard/PendingActions"
import { Badge } from "@/components/ui/badge"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"
import type { RiskListItem, QuarterRiskScores } from "@/features/risks/queries"
import type { ActionItem } from "@/features/action-items/queries"
import PageHeader from "@/components/shared/PageHeader"
import PeriodPicker from "@/components/shared/PeriodPicker"

export default function DepartmentDashboard({
  year,
  quarter,
  isLive,
  kpiSeries,
  objectiveSeries,
  risks,
  riskSeries,
  actionItems,
  snapshot,
  preparedBy,
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
  /** Risks for the selected period only — the card and the snapshot are not a trend. */
  risks: RiskListItem[]
  /** Whole-year series: average score before and after treatment per quarter. */
  riskSeries: QuarterRiskScores[]
  /** Standing open work. Not period-scoped, so the picker does not touch it. */
  actionItems: ActionItem[]
  /** The period's formal read-out, opened from the header. Counted from the same records as the cards. */
  snapshot: PeriodSnapshot
  preparedBy: string
}) {
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const period = `${quarter} ${year}`

  // The selected quarter's slice of the year series. Undefined when the
  // quarter has no reporting_periods row at all.
  const kpis = kpiSeries.find((q) => q.label === quarter)
  const objectives = objectiveSeries.find((q) => q.label === quarter)

  return (
    <div className="flex-1 space-y-3 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Department Dashboard"
        description="Overview of objectives, KPIs, and risk registers for the selected period."
        beside={
          isLive ? (
            <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-medium rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-medium rounded-full border-slate-300 bg-slate-100 text-slate-700">
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-slate-400" />
              Historical
            </Badge>
          )
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setIsSheetOpen(true)} className="h-9 gap-2 bg-white">
              <FileBarChart className="h-4 w-4" />
              Period report
            </Button>
            <PeriodPicker year={year} quarter={quarter} />
          </>
        }
      />

      {/* ── Dashboard rows ── one grid owns the layout; nothing stretches
          to a sibling column's height. */}

      {/* Row 1: the quick pulse */}
      <OverviewCards kpis={kpis} objectives={objectives} risks={risks} />

      {/* Row 2: the three year-series charts, equal cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        <ObjectiveReportingChart year={year} series={objectiveSeries} />
        <KpiPerformanceChart year={year} series={kpiSeries} />
        <RiskScoreTrend year={year} series={riskSeries} />
      </div>

      {/* Row 3: standing open work, full width */}
      <PendingActions items={actionItems} />

      {/* ── Period report slide-out ── */}
      <SlideOutSheet
        title={`${period} Data Snapshot`}
        description="Counted from this department's records for the selected period."
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      >
        <PeriodSnapshotPanel
          period={period}
          snapshot={snapshot}
          preparedBy={preparedBy}
          onCancel={() => setIsSheetOpen(false)}
        />
      </SlideOutSheet>

    </div>
  )
}
