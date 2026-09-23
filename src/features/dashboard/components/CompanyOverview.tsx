"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
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
  bandMeasuredPercent,
  bandOverdueActions,
} from "@/features/dashboard/heatmap"
import { trendSeries } from "@/features/dashboard/company"
import type {
  TrendSeriesRow,
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
 * A hollow point for a quarter that is still open, and nothing at all for
 * the closed quarter the dashed segment starts from — that one already has
 * its filled dot from the solid series.
 */
function hollowDot(color: string) {
  const Dot = (props: { cx?: number; cy?: number; index?: number; payload?: { provisional?: boolean } }) => {
    const { cx, cy, index, payload } = props
    if (!payload?.provisional || cx == null || cy == null) {
      return <g key={`empty-${index}`} />
    }
    return (
      <circle
        key={`provisional-${index}`}
        cx={cx}
        cy={cy}
        r={4}
        fill="var(--card)"
        stroke={color}
        strokeWidth={2}
      />
    )
  }
  return Dot
}

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
  periodOpen,
  totals,
  standings,
  trend,
  viewSelector,
}: {
  year: string
  quarter: string
  /** The selected quarter is still accepting figures. */
  periodOpen: boolean
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

  const trendData = trendSeries(trend, asPercent)

  const hasTrend = trendData.some((t) => t.kpiRaw !== null || t.objRaw !== null)

  return (
    <div className="flex-1 space-y-3 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Company overview"
        description={
          periodOpen
            ? `${quarter} ${year} · in progress — figures change as departments enter data`
            : `Every department together, ${quarter} ${year}.`
        }
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
                    {/* The sub-line is completeness, not the score: how
                        much of what the department owes this quarter has
                        arrived. While the quarter is open, that is also
                        what decides whether the cell may be coloured. */}
                    <TableCell>
                      <Cell
                        band={bandMeasuredPercent(
                          asPercent(d.kpiRatio),
                          d.kpiEntered,
                          d.kpiDue,
                          periodOpen
                        )}
                        value={pct(d.kpiRatio)}
                        detail={`${d.kpiEntered} of ${d.kpiDue} measured`}
                      />
                    </TableCell>
                    <TableCell>
                      <Cell
                        band={bandMeasuredPercent(
                          asPercent(d.objAchievement),
                          d.objEntered,
                          d.objDue,
                          periodOpen
                        )}
                        value={pct(d.objAchievement)}
                        detail={`${d.objEntered} of ${d.objDue} measured`}
                      />
                    </TableCell>
                    <TableCell>
                      {/* An empty register has no verdict, and an
                          unassessed risk makes the number unknowable rather
                          than good. Both read as a dash, not a green nought. */}
                      <Cell
                        band={bandCriticalRisks(
                          d.critical,
                          d.notAssessed,
                          d.risksActive
                        )}
                        value={
                          d.risksActive === 0
                            ? "—"
                            : d.notAssessed > 0
                              ? `${d.critical} · ${d.notAssessed} not assessed`
                              : String(d.critical)
                        }
                        detail={
                          d.risksActive === 0 ? "no risks" : `of ${d.risksActive} open`
                        }
                      />
                    </TableCell>
                    <TableCell>
                      {/* Nothing on the list is not the same as nothing
                          late. Nought overdue out of real open work stays
                          green. */}
                      <Cell
                        band={bandOverdueActions(d.overdue, d.openActions)}
                        value={d.openActions === 0 ? "—" : String(d.overdue)}
                        detail={
                          d.openActions === 0
                            ? "no open actions"
                            : `of ${d.openActions} open`
                        }
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
                  {/* The value at the end of the bar, so a 0% bar still
                      reads as a measured nought rather than a chart that
                      failed to draw. */}
                  <Bar dataKey="percent" fill="var(--color-percent)" radius={4}>
                    <LabelList
                      dataKey="percent"
                      position="right"
                      offset={8}
                      className="fill-foreground"
                      fontSize={12}
                      formatter={(v: unknown) => (typeof v === "number" ? `${v}%` : "")}
                    />
                  </Bar>
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
                  margin={{ top: 20, right: 12, left: 0, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} strokeDasharray="3 3" />
                  <XAxis dataKey="quarter" tickLine={false} tickMargin={10} axisLine={false} />
                  {/* A negative left margin cropped the widest tick to
                      "00%". The axis gets the width it needs instead. */}
                  <YAxis
                    domain={[0, 100]}
                    unit="%"
                    width={48}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        // The solid series is cut short at an open
                        // quarter, so the number comes from the row rather
                        // than from the series that happened to fire.
                        formatter={(value, name, item) => {
                          const row = item?.payload as TrendSeriesRow | undefined
                          const raw =
                            name === "kpi" ? row?.kpiRaw : row?.objRaw
                          return (
                            <div className="flex w-full items-center justify-between gap-4">
                              <span className="text-muted-foreground">
                                {trendConfig[name as keyof typeof trendConfig]?.label ?? name}
                              </span>
                              <span className="font-mono font-medium tabular-nums text-foreground">
                                {typeof raw === "number" ? `${raw}%` : "—"}
                              </span>
                            </div>
                          )
                        }}
                        labelFormatter={(label, payload) => {
                          const row = payload?.[0]?.payload as TrendSeriesRow | undefined
                          return (
                            <div>
                              <span>
                                {label} {year}
                              </span>
                              {row?.provisional && (
                                <div className="text-muted-foreground font-normal">
                                  provisional — quarter still open
                                </div>
                              )}
                            </div>
                          )
                        }}
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
                  {/* The provisional tail: dashed into a hollow point, out
                      of the legend, and out of the tooltip — which
                      ChartTooltipContent drops on type "none", so hovering
                      still shows one row per measure. */}
                  <Line
                    dataKey="kpiProvisional"
                    stroke="var(--color-kpi)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={hollowDot(CHART.ink)}
                    activeDot={false}
                    connectNulls={false}
                    legendType="none"
                    tooltipType="none"
                  />
                  <Line
                    dataKey="objectivesProvisional"
                    stroke="var(--color-objectives)"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={hollowDot(CHART.achieved)}
                    activeDot={false}
                    connectNulls={false}
                    legendType="none"
                    tooltipType="none"
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
