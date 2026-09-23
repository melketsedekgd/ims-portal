"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import PageHeader from "@/components/shared/PageHeader"
import PeriodPicker from "@/components/shared/PeriodPicker"
import { CHART, HEATMAP_CELL } from "@/components/shared/status-styles"
import { DASHBOARD_CHART_AREA } from "@/components/dashboard/TrendCharts"
import {
  asPercent,
  bandCriticalRisks,
  bandOverdueActions,
  bandPercent,
} from "@/features/dashboard/heatmap"
import type {
  CompanyTotals,
  DepartmentStanding,
  TrendPoint,
} from "@/features/dashboard/company"

const pct = (fraction: number | null) => {
  const p = asPercent(fraction)
  return p === null ? "—" : `${p}%`
}

/** A totals card: one number, one line of what it is made of. */
function Total({
  title,
  value,
  detail,
}: {
  title: string
  value: string
  detail: string
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums text-ink">{value}</div>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  )
}

/**
 * A heatmap cell. The band decides the colour and nothing else does, so a
 * cell can never be coloured by one rule and labelled by another.
 */
function Cell({
  band,
  value,
  detail,
}: {
  band: "good" | "warn" | "bad" | "neutral"
  value: string
  detail?: string
}) {
  return (
    <div className={`rounded-md px-2.5 py-1.5 ${HEATMAP_CELL[band]}`}>
      <div className="text-sm font-medium tabular-nums">{value}</div>
      {detail && <div className="text-xs opacity-80">{detail}</div>}
    </div>
  )
}

const barConfig = {
  percent: { label: "On target", color: CHART.ink },
} satisfies ChartConfig

const trendConfig = {
  kpi: { label: "KPIs on target", color: CHART.ink },
  objectives: { label: "Objective achievement", color: CHART.achieved },
} satisfies ChartConfig

/**
 * The company as a whole for one quarter: what it scored, which
 * departments carry the problems, and which way the year is going.
 *
 * Not an aggregate dashboard — there is no company KPI register. Every
 * number here is built from the departments' own figures, and every row is
 * a way into the department that owns it.
 */
export default function CompanyOverview({
  year,
  quarter,
  totals,
  standings,
  trend,
  viewSelector,
}: {
  year: string
  quarter: string
  totals: CompanyTotals
  standings: DepartmentStanding[]
  trend: TrendPoint[]
  viewSelector: React.ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const open = (code: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("view")
    params.set("dept", code)
    router.push(`?${params.toString()}`)
  }

  // Departments that measured nothing are left out rather than drawn at
  // zero: a bar at the floor says they missed every target, when in fact
  // they reported nothing at all.
  const barData = standings
    .filter((d) => d.kpiMeasured > 0)
    .map((d) => ({
      name: d.name,
      code: d.code,
      percent: asPercent(d.kpiRatio) ?? 0,
      measured: d.kpiMeasured,
      onTarget: d.kpiOnTarget,
    }))
    .sort((a, b) => b.percent - a.percent)

  const trendData = trend.map((t) => ({
    quarter: t.quarter,
    kpi: asPercent(t.kpiRatio),
    objectives: asPercent(t.objAchievement),
  }))

  const hasTrend = trendData.some((t) => t.kpi !== null || t.objectives !== null)

  return (
    <div className="flex-1 space-y-3 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Company overview"
        description={`Every department together, ${quarter} ${year}.`}
        actions={
          <>
            {viewSelector}
            <PeriodPicker year={year} quarter={quarter} />
          </>
        }
      />

      {/* ── Row 1: the company's four numbers ── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <Total
          title="KPIs on target"
          value={pct(totals.kpiRatio)}
          detail={`${totals.kpiOnTarget} of ${totals.kpiMeasured} measured`}
        />
        <Total
          title="Objectives"
          value={pct(totals.objAchievement)}
          detail={`${totals.objMeasured} measured this quarter`}
        />
        <Total
          title="Critical risks"
          value={String(totals.critical)}
          detail={`of ${totals.risksActive} open · ${totals.notAssessed} not assessed`}
        />
        <Total
          title="Overdue actions (now)"
          value={String(totals.overdue)}
          detail={`across ${totals.overdueDepartments} ${
            totals.overdueDepartments === 1 ? "department" : "departments"
          }`}
        />
      </div>

      {/* ── Row 2: which department carries which problem ── */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Department</TableHead>
                <TableHead>KPIs on target</TableHead>
                <TableHead>Objectives</TableHead>
                <TableHead>Critical risks</TableHead>
                <TableHead>Overdue actions (now)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {standings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    No departments to show.
                  </TableCell>
                </TableRow>
              ) : (
                standings.map((d) => (
                  <TableRow
                    key={d.departmentId}
                    onClick={() => open(d.code)}
                    className="cursor-pointer"
                  >
                    <TableCell className="font-medium text-ink">
                      {d.name}
                      <span className="ml-2 text-xs text-muted-foreground">{d.code}</span>
                    </TableCell>
                    <TableCell>
                      <Cell
                        band={bandPercent(asPercent(d.kpiRatio))}
                        value={pct(d.kpiRatio)}
                        detail={
                          d.kpiMeasured > 0
                            ? `${d.kpiOnTarget} of ${d.kpiMeasured}`
                            : "none measured"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Cell
                        band={bandPercent(asPercent(d.objAchievement))}
                        value={pct(d.objAchievement)}
                        detail={
                          d.objMeasured > 0
                            ? `${d.objMeasured} measured`
                            : "none measured"
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {/* An unassessed risk makes the number unknowable
                          rather than good, so it is shown uncoloured with
                          the reason attached. */}
                      <Cell
                        band={bandCriticalRisks(d.critical, d.notAssessed)}
                        value={
                          d.notAssessed > 0
                            ? `${d.critical} · ${d.notAssessed} not assessed`
                            : String(d.critical)
                        }
                        detail={`of ${d.risksActive} open`}
                      />
                    </TableCell>
                    <TableCell>
                      <Cell
                        band={bandOverdueActions(d.overdue)}
                        value={String(d.overdue)}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ── Row 3: the same quarter across departments, and the year ── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>KPIs on target by department · {quarter}</CardTitle>
            <CardDescription>
              Departments that measured nothing this quarter are not shown.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {barData.length === 0 ? (
              <div className={`${DASHBOARD_CHART_AREA} flex items-center justify-center text-center px-6`}>
                <p className="text-sm text-muted-foreground">
                  No department measured a KPI in {quarter} {year}.
                </p>
              </div>
            ) : (
              <ChartContainer config={barConfig} className={`${DASHBOARD_CHART_AREA} w-full`}>
                <BarChart
                  accessibilityLayer
                  data={barData}
                  layout="vertical"
                  margin={{ top: 4, right: 32, left: 0, bottom: 0 }}
                >
                  <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    unit="%"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <YAxis
                    type="category"
                    dataKey="code"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={64}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        formatter={(value) => (
                          <span className="font-mono font-medium tabular-nums text-foreground">
                            {value}%
                          </span>
                        )}
                        labelFormatter={(_, payload) => {
                          const d = payload?.[0]?.payload as
                            | (typeof barData)[number]
                            | undefined
                          return d ? `${d.name} — ${d.onTarget} of ${d.measured}` : ""
                        }}
                      />
                    }
                  />
                  <Bar dataKey="percent" fill="var(--color-percent)" radius={4} />
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Company trend · {year}</CardTitle>
            <CardDescription>
              KPIs on target and objective achievement, every quarter.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1">
            {!hasTrend ? (
              <div className={`${DASHBOARD_CHART_AREA} flex items-center justify-center text-center px-6`}>
                <p className="text-sm text-muted-foreground">
                  Nothing has been measured in {year} yet.
                </p>
              </div>
            ) : (
              <ChartContainer config={trendConfig} className={`${DASHBOARD_CHART_AREA} w-full`}>
                <LineChart
                  accessibilityLayer
                  data={trendData}
                  margin={{ top: 20, right: 12, left: -20, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" tickLine={false} tickMargin={10} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        formatter={(value, name) => (
                          <div className="flex w-full items-center justify-between gap-4">
                            <span className="text-muted-foreground">
                              {trendConfig[name as keyof typeof trendConfig]?.label ?? name}
                            </span>
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {typeof value === "number" ? `${value}%` : "—"}
                            </span>
                          </div>
                        )}
                      />
                    }
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {/* connectNulls stays off: a quarter with nothing measured
                      is a gap in the record, and bridging it would invent a
                      line between two quarters that never met. */}
                  <Line
                    dataKey="kpi"
                    stroke="var(--color-kpi)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                  <Line
                    dataKey="objectives"
                    stroke="var(--color-objectives)"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls={false}
                  />
                </LineChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
