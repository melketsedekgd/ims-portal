"use client"

import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { CHART } from "@/components/shared/status-styles"
import type { QuarterRiskScores } from "@/features/risks/queries"

const config = {
  baseline: { label: "Before treatment", color: CHART.baseline },
  residual: { label: "After treatment", color: CHART.ink },
} satisfies ChartConfig

const fmt = (v: number) => v.toFixed(1)

/** "Q3 and Q4 have no assessments yet." — English list, no Oxford comma at two. */
function listOf(labels: string[]): string {
  if (labels.length === 1) return labels[0]
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`
}

/**
 * Average risk score before and after treatment, one point per quarter.
 *
 * Each quarter averages whichever risks were assessed in it, and both lines
 * average the same set — the gap between them is what treatment cut. The
 * sets differ between quarters (IT: 8 in Q1, 12 in Q2), so the tooltip
 * carries the count and nobody should read the line as the same risks
 * improving. A quarter with no residual assessments is a gap, never a zero.
 */
export function RiskScoreTrend({
  year,
  series,
}: {
  year: string
  series: QuarterRiskScores[]
}) {
  const empty = series.filter((q) => q.assessed === 0).map((q) => q.label)
  const allEmpty = series.length > 0 && empty.length === series.length
  const maxAvg = Math.max(0, ...series.flatMap((q) => [q.baseline ?? 0, q.residual ?? 0]))
  const yMax = maxAvg > 20 ? 25 : 20
  const registerHref = `/department/risks?year=${year}&quarter=Q1`

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Risk scores</CardTitle>
        <CardDescription>Average score before and after treatment, {year}</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        {series.length === 0 ? (
          <div className="h-[300px] flex items-center justify-center text-center px-6">
            <p className="text-sm text-muted-foreground">
              No quarterly reporting periods exist for {year}.
            </p>
          </div>
        ) : allEmpty ? (
          <div className="h-[300px] flex flex-col items-center justify-center gap-3 text-center px-6">
            <p className="text-sm text-muted-foreground">
              No risks have been assessed in {year} yet.
            </p>
            <Link
              href={registerHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              View the risk register
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <>
            <ChartContainer config={config} className="h-[300px] w-full">
              <LineChart accessibilityLayer data={series} margin={{ top: 20, right: 12, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tickLine={false} tickMargin={10} axisLine={false} />
                <YAxis domain={[0, yMax]} tickLine={false} axisLine={false} tickMargin={10} allowDecimals={false} />
                <ChartTooltip
                  cursor={false}
                  // Lines are drawn residual-first (see below); the tooltip
                  // should still read before → after.
                  itemSorter={(item) => (item.dataKey === "baseline" ? 0 : 1)}
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        const label = config[name as keyof typeof config]?.label ?? name
                        return (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {typeof value === "number" ? fmt(value) : "—"}
                            </span>
                          </div>
                        )
                      }}
                      labelFormatter={(label, payload) => {
                        const q = payload?.[0]?.payload as QuarterRiskScores | undefined
                        return (
                          <div className="flex items-baseline justify-between gap-4">
                            <span>{label} {year}</span>
                            {q && (
                              <span className="text-muted-foreground font-normal">
                                {q.assessed} {q.assessed === 1 ? "risk" : "risks"} assessed
                              </span>
                            )}
                          </div>
                        )
                      }}
                    />
                  }
                />
                <ChartLegend content={<ChartLegendContent />} />
                {/* Residual first, baseline after: when the two points
                    coincide (SRD's do, 13.7 on 13.7) the hollow ring is drawn
                    on top and both stay visible. */}
                <Line
                  dataKey="residual"
                  type="linear"
                  stroke="var(--color-residual)"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: "var(--color-residual)", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
                <Line
                  dataKey="baseline"
                  type="linear"
                  stroke="var(--color-baseline)"
                  strokeWidth={2}
                  strokeDasharray="6 4"
                  dot={{ r: 5, fill: "var(--card)", stroke: "var(--color-baseline)", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "var(--card)", stroke: "var(--color-baseline)", strokeWidth: 2 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ChartContainer>
            {empty.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {listOf(empty)} {empty.length === 1 ? "has" : "have"} no assessments yet.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
