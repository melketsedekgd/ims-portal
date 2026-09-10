import Link from "next/link"
import { Target, BarChart3, ShieldAlert, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { riskBand, type RiskBand } from "@/features/risks/scoring"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"
import type { RiskListItem } from "@/features/risks/queries"

function Chip({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full ${tone}`}>
      <span className="tabular-nums font-semibold mr-1">{value}</span>
      {label}
    </span>
  )
}

const TONE = {
  good: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  bad: "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  warn: "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  neutral: "bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400",
  info: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
}

// A quarter with no reporting_periods row has no counts at all, which is not
// the same as a quarter whose counts are zero.
function NoPeriod() {
  return (
    <p className="text-xs text-muted-foreground">
      No reporting period exists for this quarter.
    </p>
  )
}

export function OverviewCards({
  kpis,
  objectives,
  risks,
}: {
  kpis: QuarterKpiCounts | undefined
  objectives: QuarterObjectiveCounts | undefined
  risks: RiskListItem[]
}) {
  // Banded through riskBand so an unscored risk lands in not_assessed. A
  // `riskScore < 5` test would put it in Low, because null < 5 is true.
  const riskCounts: Record<RiskBand, number> = {
    critical: 0,
    medium: 0,
    low: 0,
    not_assessed: 0,
  }
  for (const r of risks) riskCounts[riskBand(r.riskScore)]++

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* ── 1. Objective Card ── */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-muted-foreground">
            Objectives
          </CardTitle>
          <div className="p-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
            <Target className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tracking-tight text-foreground">
            {objectives ? objectives.total : "—"}
          </div>
          {objectives ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <Chip value={objectives.measured} label="measured" tone={TONE.info} />
              <Chip value={objectives.notReported} label="not reported" tone={TONE.neutral} />
              <Chip value={objectives.completedEarlier} label="completed earlier" tone={TONE.good} />
              <Chip value={objectives.notMeasured} label="N/A" tone={TONE.neutral} />
            </div>
          ) : (
            <NoPeriod />
          )}
        </CardContent>
        <CardFooter className="pt-2 border-t text-xs">
          <Link
            href="/department/objectives"
            className="flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            View all objectives
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardFooter>
      </Card>

      {/* ── 2. KPI Card ── */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-muted-foreground">
            KPIs
          </CardTitle>
          <div className="p-2 rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400">
            <BarChart3 className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* A count, not a rate. Any percentage needs a denominator, and both
              choices misstate a quarter nobody has measured yet. */}
          <div className="text-3xl font-bold tracking-tight text-foreground">
            {kpis ? kpis.total : "—"}
          </div>
          {kpis ? (
            <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
              <Chip value={kpis.achieved} label="achieved" tone={TONE.good} />
              <Chip value={kpis.deviated} label="deviated" tone={TONE.bad} />
              <Chip value={kpis.pending} label="pending" tone={TONE.neutral} />
            </div>
          ) : (
            <NoPeriod />
          )}
        </CardContent>
        <CardFooter className="pt-2 border-t text-xs">
          <Link
            href="/department/kpis"
            className="flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            View all KPIs
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardFooter>
      </Card>

      {/* ── 3. Risk Card ── */}
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base font-semibold text-muted-foreground">
            Risks
          </CardTitle>
          <div className="p-2 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
            <ShieldAlert className="h-5 w-5" />
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tracking-tight text-foreground">{risks.length}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
            <Chip value={riskCounts.critical} label="Critical" tone={TONE.bad} />
            <Chip value={riskCounts.medium} label="Medium" tone={TONE.warn} />
            <Chip value={riskCounts.low} label="Low" tone={TONE.good} />
            <Chip value={riskCounts.not_assessed} label="Not assessed" tone={TONE.neutral} />
          </div>
        </CardContent>
        <CardFooter className="pt-2 border-t text-xs">
          <Link
            href="/department/risks"
            className="flex items-center gap-1.5 font-medium text-primary hover:underline"
          >
            View all risks
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
