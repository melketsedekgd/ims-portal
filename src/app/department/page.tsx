import { OverviewCards } from "@/components/dashboard/OverviewCards"
import { TrendCharts } from "@/components/dashboard/TrendCharts"
import { RiskMatrix } from "@/components/dashboard/RiskMatrix"

export default function DepartmentDashboardPage() {
  return (
    <div className="flex-1 space-y-6 p-6">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">Department Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Overview of quarterly objectives, KPIs, and active risk registers.
        </p>
      </div>

      {/* ── Overview Metric Cards ── */}
      <OverviewCards />

      {/* ── Trend Graphs ── */}
      <TrendCharts />

      {/* ── Risk Heatmap ── */}
      <RiskMatrix />
    </div>
  )
}
