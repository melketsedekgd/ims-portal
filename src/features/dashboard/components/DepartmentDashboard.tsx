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
import { OpenActionsCard } from "@/components/dashboard/OpenActionsCard"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"
import type { RiskListItem, QuarterRiskScores } from "@/features/risks/queries"
import type { OpenAction } from "@/features/action-items/queries"
import PageHeader from "@/components/shared/PageHeader"
import PeriodPicker from "@/components/shared/PeriodPicker"
import {
  SignoffBadge,
  SignoffSubtitle,
  SignoffActions,
} from "@/features/signoff/components/SignoffHeader"
import type { HeaderSignoff } from "@/features/signoff/queries"

export default function DepartmentDashboard({
  year,
  quarter,
  years,
  isLive,
  kpiSeries,
  objectiveSeries,
  risks,
  riskSeries,
  actions,
  snapshot,
  preparedBy,
  signoff,
  departmentName,
  isEmpty,
  viewSelector,
  footer,
}: {
  year: string
  quarter: string
  years: number[]
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
  /** Open work across actions, risk treatments and objective activities. */
  actions: OpenAction[]
  /** The period's formal read-out, opened from the header. Counted from the same records as the cards. */
  snapshot: PeriodSnapshot
  preparedBy: string
  /** Sign-off state for this quarter, or null when no single department applies. */
  signoff: HeaderSignoff | null
  /**
   * The department these figures are for, when one was named. Null for
   * everyone whose dashboard is an RLS-scoped pool rather than a choice,
   * which is every non-IMS user.
   */
  departmentName: string | null
  /** The named department has no KPIs, objectives or risks at all. */
  isEmpty: boolean
  /** IMS's view selector, or null for everyone else. */
  viewSelector: React.ReactNode
  /**
   * Anything that belongs under the dashboard proper. IMS's own view puts
   * the quarterly reporting tracker here — outside the empty-state branch,
   * because chasing other departments' quarters is IMS's work whether or
   * not IMS has any figures of its own yet.
   */
  footer?: React.ReactNode
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
        /* The department is the title. It was a pill beside "Department
           Dashboard", which named the page rather than what is on it —
           every page here is a department dashboard, and only one of them
           is SRD's. Nobody, or two departments, leaves no single name to
           use, so the generic title stays for that case alone. */
        title={departmentName ?? "Dashboard"}
        description={
          <SignoffSubtitle
            signoff={signoff}
            fallback="Overview of objectives, KPIs, and risk registers for the selected period."
          />
        }
        beside={
          <>
            <SignoffBadge signoff={signoff} />
            {isLive ? (
            <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-medium rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
              Live
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-medium rounded-full border-slate-300 bg-slate-100 text-slate-700">
              <span className="inline-flex rounded-full h-2.5 w-2.5 bg-slate-400" />
                Historical
              </Badge>
            )}
          </>
        }
        actions={
          <>
            {/* A period report over nothing is the empty charts by another
                route, so it goes with them. */}
            {!isEmpty && (
              <Button variant="outline" onClick={() => setIsSheetOpen(true)} className="h-9 gap-2 bg-white">
                <FileBarChart className="h-4 w-4" />
                Period report
              </Button>
            )}
            {viewSelector}
            <PeriodPicker year={year} quarter={quarter} years={years} />
          </>
        }
        below={<SignoffActions signoff={signoff} />}
      />

      {/* A department with nothing in it is not a department reporting
          zeroes. Four cards reading 0 and three flat charts say "measured
          and found empty"; this says nobody has set it up yet, which is
          what is actually true of IMS today. */}
      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <p className="text-sm font-medium text-ink">
              Nothing set up for this department yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              No KPIs, objectives or risks have been created for
              {departmentName ? ` ${departmentName}` : " it"}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
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

          {/* Row 3: open work across actions, treatments and activities, full width */}
          <OpenActionsCard actions={actions} />

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
              signoff={signoff}
              onCancel={() => setIsSheetOpen(false)}
            />
          </SlideOutSheet>
        </>
      )}

      {footer}
    </div>
  )
}
