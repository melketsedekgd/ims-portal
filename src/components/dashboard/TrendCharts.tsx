"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"
import { CHART } from "@/components/shared/status-styles"

/**
 * One height for every chart area on the dashboard so the three cards in
 * the row line up. RiskScoreTrend uses it too; its footnote sits inside
 * this box rather than under it, so that card never grows past the others.
 */
export const DASHBOARD_CHART_AREA = "h-[260px]"

/**
 * Axes and gridlines in ink, light and thin, for every dashboard chart.
 * The tick colour needs `!`: ChartContainer already sets the same selector
 * to muted-foreground and the two would otherwise tie. The grid sets its
 * own stroke, which also takes it out of ChartContainer's #ccc override.
 */
export const DASHBOARD_CHART_AXES = "[&_.recharts-cartesian-axis-tick_text]:fill-ink-2!"
export const DASHBOARD_CHART_GRID = {
  stroke: "var(--ink)",
  strokeOpacity: 0.08,
  strokeWidth: 1,
} as const

/** The primary series colour: coral, from the token rather than a hex. */
export const DASHBOARD_CHART_PRIMARY = "var(--coral)"

// Colours come from the shared status map so the bars say the same thing
// as the pills: emerald achieved, rose deviated, slate for pending and
// not-measured. The one series that is not a status — objectives measured —
// is the primary series, in coral.
const objectiveConfig = {
  measured: { label: "Measured", color: DASHBOARD_CHART_PRIMARY },
  total: { label: "Total objectives", color: CHART.total },
} satisfies ChartConfig

const kpiConfig = {
  achieved: { label: "Achieved", color: CHART.achieved },
  deviated: { label: "Deviated", color: CHART.deviated },
  pending: { label: "Pending", color: CHART.pending },
  notMeasured: { label: "Not Measured", color: CHART.notMeasured },
} satisfies ChartConfig

function EmptyChart({ year }: { year: string }) {
  return (
    <div className={`${DASHBOARD_CHART_AREA} flex items-center justify-center text-center px-6`}>
      <p className="text-sm text-muted-foreground">
        No quarterly reporting periods exist for {year}.
      </p>
    </div>
  )
}

/** The card frame both charts share: full height of its grid cell, content stretched. */
function TrendCard({
  title,
  description,
  children,
}: {
  title: string
  description: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="font-semibold text-ink">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1">{children}</CardContent>
    </Card>
  )
}

/**
 * Both charts are quarterly series over real reporting periods. They are
 * separate components, not one grid: the dashboard owns the row they sit
 * in, alongside RiskScoreTrend.
 *
 * The KPI chart used to synthesise five monthly points from the selected
 * quarter's score with a fixed variance array, which made the line slope
 * upward on any data. There is no monthly series to plot: every
 * kpi_measurement points at a quarterly period.
 */
export function ObjectiveReportingChart({
  year,
  series,
}: {
  year: string
  series: QuarterObjectiveCounts[]
}) {
  const data = series.map((q) => ({
    quarter: q.label,
    measured: q.measured,
    total: q.total,
  }))

  return (
    <TrendCard
      title="Objective Reporting"
      description={<>{year} — objectives measured each quarter, against the total on the register</>}
    >
      {data.length === 0 ? (
        <EmptyChart year={year} />
      ) : (
        <ChartContainer config={objectiveConfig} className={`${DASHBOARD_CHART_AREA} ${DASHBOARD_CHART_AXES} w-full`}>
          <BarChart accessibilityLayer data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} {...DASHBOARD_CHART_GRID} />
            <XAxis dataKey="quarter" tickLine={false} tickMargin={10} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="dashed" />} />
            <ChartLegend content={<ChartLegendContent />} />
            {/* Total is flat: an objective is long-lived and exists whether
                or not it was reported on. What moves is how many were
                measured. */}
            <Bar dataKey="total" fill="var(--color-total)" opacity={0.3} radius={4} />
            <Bar dataKey="measured" fill="var(--color-measured)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </TrendCard>
  )
}

export function KpiPerformanceChart({
  year,
  series,
}: {
  year: string
  series: QuarterKpiCounts[]
}) {
  const data = series.map((q) => ({
    quarter: q.label,
    achieved: q.achieved,
    deviated: q.deviated,
    pending: q.pending,
    notMeasured: q.notMeasured,
  }))

  return (
    <TrendCard
      title="KPI Performance"
      description={<>{year} — every KPI counted each quarter, including those not yet measured</>}
    >
      {data.length === 0 ? (
        <EmptyChart year={year} />
      ) : (
        <ChartContainer config={kpiConfig} className={`${DASHBOARD_CHART_AREA} ${DASHBOARD_CHART_AXES} w-full`}>
          <BarChart accessibilityLayer data={data} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid vertical={false} {...DASHBOARD_CHART_GRID} />
            <XAxis dataKey="quarter" tickLine={false} tickMargin={10} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} />
            <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            {/* Stacked, so the bar height is the KPI count and no hidden
                denominator decides what a quarter "scored". A quarter with
                nothing entered is a full bar of Pending, not a zero. */}
            <Bar dataKey="achieved" stackId="kpi" fill="var(--color-achieved)" radius={[0, 0, 4, 4]} />
            <Bar dataKey="deviated" stackId="kpi" fill="var(--color-deviated)" />
            <Bar dataKey="pending" stackId="kpi" fill="var(--color-pending)" />
            <Bar dataKey="notMeasured" stackId="kpi" fill="var(--color-notMeasured)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      )}
    </TrendCard>
  )
}
