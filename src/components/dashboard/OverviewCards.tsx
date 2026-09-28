import { Target, BarChart3, AlertTriangle } from "lucide-react"
import { StatTile, TilePill } from "@/features/dashboard/components/StatTile"
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

  // Same numbers and the same pills as before. The first pill of each card
  // moves to the top-right slot, keeping its colour; the percentage badges
  // were blue, which is not a status colour here, so they take ink's tint.
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* ── Card 1: Objectives ── */}
      <StatTile
        icon={Target}
        value={totalObjectives}
        label="Total Objectives"
        status={<TilePill tone="good">{objectivesAchieved} Achieved</TilePill>}
      >
        <TilePill tone="neutral">{achievementRate}% Achievement</TilePill>
      </StatTile>

      {/* ── Card 2: KPIs ── */}
      <StatTile
        icon={BarChart3}
        value={totalKpis}
        label="Total KPIs"
        status={<TilePill tone="good">{kpisAchieved} Achieved</TilePill>}
      >
        <TilePill tone="neutral">{kpiAchievementRate}% Achievement</TilePill>
      </StatTile>

      {/* ── Card 3: Risks ── */}
      <StatTile
        icon={AlertTriangle}
        value={totalActiveRisks}
        label="Total Active Risks"
        status={<TilePill tone="bad">{highCriticalRisks} High / Critical</TilePill>}
      >
        <TilePill tone="warn">{risksRequiringAction} Requiring Action</TilePill>
      </StatTile>
    </div>
  )
}
