import { OverviewCards } from "@/components/dashboard/OverviewCards"
import { TrendCharts } from "@/components/dashboard/TrendCharts"
import { RiskMatrix } from "@/components/dashboard/RiskMatrix"
import { RecentActivity } from "@/components/dashboard/RecentActivity"
import { PendingActions } from "@/components/dashboard/PendingActions"
import { Badge } from "@/components/ui/badge"

export default function DepartmentDashboardPage() {
  const currentDate = new Date();
  const currentQuarter = Math.floor(currentDate.getMonth() / 3) + 1;
  const currentYear = currentDate.getFullYear();

  return (
    <div className="flex-1 space-y-3 p-4 md:p-6 w-full">
      {/* ── Page Header ── */}
      <div className="flex flex-col gap-1 mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Department Dashboard</h1>
          
          {/* Live Quarter Badge - Outlined with Light Opacity */}
          <Badge variant="outline" className="gap-2 px-3 py-1 text-sm font-semibold rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400 shadow-sm">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            Live: Q{currentQuarter} {currentYear}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of quarterly objectives, KPIs, and active risk registers.
        </p>
      </div>

      {/* ── Dashboard Bento Grid ── */}
      
      {/* Row 1: The Quick Pulse (100% width) */}
      <div className="w-full">
        <OverviewCards />
      </div>

      {/* ── Dashboard Columns (Left 60% / Right 40%) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
        
        {/* Left Column: Heavy Analytics & Activity */}
        <div className="lg:col-span-3 flex flex-col gap-3">
          <TrendCharts />
          <RecentActivity />
        </div>
        
        {/* Right Column: Risk & Pending Actions */}
        <div className="lg:col-span-2 flex flex-col gap-3">
          <RiskMatrix />
          <PendingActions />
        </div>
        
      </div>

    </div>
  )
}
