import { Target, BarChart3, AlertTriangle } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"
import type { RiskListItem } from "@/features/risks/queries"

export function OverviewCards({
  kpis,
  objectives,
  risks,
}: {
  kpis: QuarterKpiCounts | undefined
  objectives: QuarterObjectiveCounts | undefined
  risks: RiskListItem[]
}) {
  // ── Objectives calculations ──
  const totalObjectives = objectives?.total ?? 0
  const objectivesAchieved = objectives?.achieved ?? 0
  const achievementRate =
    totalObjectives > 0
      ? Math.round((objectivesAchieved / totalObjectives) * 100)
      : 0

  // ── KPIs calculations ──
  const totalKpis = kpis?.total ?? 0
  const kpisAchieved = kpis?.achieved ?? 0
  const kpiAchievementRate =
    totalKpis > 0 ? Math.round((kpisAchieved / totalKpis) * 100) : 0

  // ── Risks calculations ──
  const activeRisks = risks.filter(
    (r) => r.status === "Open" || r.status === "Mitigating"
  )
  const totalActiveRisks = activeRisks.length
  const highCriticalRisks = activeRisks.filter(
    (r) => (r.riskScore ?? 0) >= 15
  ).length
  const risksRequiringAction = activeRisks.filter(
    (r) => r.status === "Open" || !r.treatment
  ).length

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* ── Card 1: Objectives ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Objectives
          </CardTitle>
          <Target className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold tabular-nums text-foreground">
            {totalObjectives}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium"
            >
              {objectivesAchieved} Achieved
            </Badge>
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
            >
              {achievementRate}% Achievement
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: KPIs ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total KPIs
          </CardTitle>
          <BarChart3 className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold tabular-nums text-foreground">
            {totalKpis}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 font-medium"
            >
              {kpisAchieved} Achieved
            </Badge>
            <Badge
              variant="outline"
              className="border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-400 font-medium"
            >
              {kpiAchievementRate}% Achievement
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 3: Risks ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Active Risks
          </CardTitle>
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-3xl font-bold tabular-nums text-foreground">
            {totalActiveRisks}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge
              variant="outline"
              className="border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-400 font-medium"
            >
              {highCriticalRisks} High / Critical
            </Badge>
            <Badge
              variant="outline"
              className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 font-medium"
            >
              {risksRequiringAction} Requiring Action
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
