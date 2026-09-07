import Link from "next/link"
import { Target, BarChart3, ShieldAlert, ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { mockObjectives, mockKpis, mockRisks } from "@/lib/mockData"

export function OverviewCards({ period }: { period: string }) {
  // Filter data
  const objectives = mockObjectives.filter(o => o.period === period)
  const kpis = mockKpis.filter(k => k.period === period)
  const risks = mockRisks.filter(r => r.period === period)

  // Calculate Objectives metrics
  const totalObj = objectives.length
  const objOnTrack = objectives.filter(o => o.status === "On Track").length
  const objLagging = totalObj - objOnTrack

  // Calculate KPIs metrics
  const totalKpi = kpis.length
  const kpiMet = kpis.filter(k => k.status === "Achieved").length
  const kpiOff = totalKpi - kpiMet
  const kpiSuccessRate = totalKpi > 0 ? Math.round((kpiMet / totalKpi) * 100) : 0

  // Calculate Risks metrics
  const totalRisk = risks.length
  const riskHigh = risks.filter(r => r.riskScore >= 15).length
  const riskMed = risks.filter(r => r.riskScore >= 5 && r.riskScore < 15).length
  const riskLow = risks.filter(r => r.riskScore < 5).length

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
          <div className="text-3xl font-bold tracking-tight text-foreground">{totalObj}</div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {objOnTrack} on track
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {objLagging} lagging
            </span>
          </div>
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
          <div className="text-3xl font-bold tracking-tight text-foreground">{kpiSuccessRate}%</div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {kpiMet} target met
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              {kpiOff} off track
            </span>
          </div>
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
          <div className="text-3xl font-bold tracking-tight text-foreground">{totalRisk}</div>
          <div className="flex items-center gap-2 text-xs font-medium">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400">
              {riskHigh} High
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
              {riskMed} Med
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
              {riskLow} Low
            </span>
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
