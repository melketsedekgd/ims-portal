"use client"

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"

// Colours match the badge language used across the app: emerald achieved,
// rose deviated, slate for anything not yet measured.
const objectiveConfig = {
  measured: { label: "Measured", color: "#3b82f6" },
  total: { label: "Total objectives", color: "#94a3b8" },
} satisfies ChartConfig

const kpiConfig = {
  achieved: { label: "Achieved", color: "#10b981" },
  deviated: { label: "Deviated", color: "#f43f5e" },
  pending: { label: "Pending", color: "#94a3b8" },
} satisfies ChartConfig

function EmptyChart({ year }: { year: string }) {
  return (
    <div className="h-[300px] flex items-center justify-center text-center px-6">
      <p className="text-sm text-muted-foreground">
        No quarterly reporting periods exist for {year}.
      </p>
    </div>
  )
}

/**
 * Both charts are quarterly series over real reporting periods.
 *
 * The KPI chart used to synthesise five monthly points from the selected
 * quarter's score with a fixed variance array, which made the line slope
 * upward on any data. There is no monthly series to plot: every
 * kpi_measurement points at a quarterly period.
 */
export function TrendCharts({
  year,
  kpiSeries,
  objectiveSeries,
}: {
  year: string
  kpiSeries: QuarterKpiCounts[]
  objectiveSeries: QuarterObjectiveCounts[]
}) {
  const objectiveData = objectiveSeries.map((q) => ({
    quarter: q.label,
    measured: q.measured,
    total: q.total,
  }))

  const kpiData = kpiSeries.map((q) => ({
    quarter: q.label,
    achieved: q.achieved,
    deviated: q.deviated,
    pending: q.pending,
  }))

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">

      {/* ── Objectives Progress ── */}
      <Card>
        <CardHeader>
          <CardTitle>Objective Reporting</CardTitle>
          <CardDescription>
            {year} — objectives measured each quarter, against the total on the register
          </CardDescription>
        </CardHeader>
        <CardContent>
          {objectiveData.length === 0 ? (
            <EmptyChart year={year} />
          ) : (
            <ChartContainer config={objectiveConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={objectiveData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
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
        </CardContent>
      </Card>

      {/* ── KPI Performance ── */}
      <Card>
        <CardHeader>
          <CardTitle>KPI Performance</CardTitle>
          <CardDescription>
            {year} — every KPI counted each quarter, including those not yet measured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {kpiData.length === 0 ? (
            <EmptyChart year={year} />
          ) : (
            <ChartContainer config={kpiConfig} className="h-[300px] w-full">
              <BarChart accessibilityLayer data={kpiData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="quarter" tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} />
                <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                {/* Stacked, so the bar height is the KPI count and no hidden
                    denominator decides what a quarter "scored". A quarter with
                    nothing entered is a full bar of Pending, not a zero. */}
                <Bar dataKey="achieved" stackId="kpi" fill="var(--color-achieved)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="deviated" stackId="kpi" fill="var(--color-deviated)" />
                <Bar dataKey="pending" stackId="kpi" fill="var(--color-pending)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

    </div>
  )
}
