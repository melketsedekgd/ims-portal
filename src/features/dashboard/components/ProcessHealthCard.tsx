import Link from "next/link"
import { cn } from "@/lib/utils"
import { DashboardListCard } from "@/features/dashboard/components/DashboardListCard"
import { bandPercent } from "@/features/dashboard/heatmap"
import { DASH_BAR_FILL } from "@/features/dashboard/status"
import type { ProcessHealth, ProcessHealthRow } from "@/features/dashboard/process-health"

const MAX_ROWS = 5

/** "↑ 20", "↓ 10", or a quiet dash for no change and for no prior data alike. */
function Change({ change }: { change: number | null }) {
  if (change === null || change === 0) return <span className="text-ink/70">–</span>
  return change > 0 ? (
    <span className="font-bold text-status-good">↑ {change}</span>
  ) : (
    <span className="font-bold text-status-bad">↓ {-change}</span>
  )
}

function ProcessRow({ row, versus }: { row: ProcessHealthRow; versus: string }) {
  return (
    // Tighter than the objectives card's rows, and no dividers, so five fit
    // in the same height.
    <li className="flex flex-col gap-1 py-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold leading-[18px] text-ink" title={row.name}>
          {row.name}
        </span>
        <span className="shrink-0 text-xs" title={versus}>
          <Change change={row.change} />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-status-pending">
          <div
            className={cn("h-full rounded-full", DASH_BAR_FILL[bandPercent(row.pct)])}
            style={{ width: `${row.pct}%` }}
          />
        </div>
        <span className="shrink-0 text-xs leading-4 text-ink">
          <b>
            {row.onTarget} of {row.measured}
          </b>{" "}
          on target
        </span>
      </div>
    </li>
  )
}

/**
 * KPIs on target per process, the struggling processes first. Every figure
 * arrives from processHealth(); this only draws them.
 */
export function ProcessHealthCard({
  year,
  quarter,
  health,
  href,
}: {
  year: string
  quarter: string
  health: ProcessHealth
  /** The KPI list for the same period and department. */
  href: string
}) {
  const shown = health.rows.slice(0, MAX_ROWS)
  const more = health.rows.length - shown.length
  const versus = `vs ${quarter} ${Number(year) - 1}`

  return (
    <DashboardListCard
      title="Process health"
      description={`${quarter} ${year} · KPIs on target per process`}
      summary={
        <>
          {health.below > 0 && <span className="text-status-bad">{health.below} below</span>}
          {health.onTarget > 0 && (
            <span className="text-status-good">{health.onTarget} on target</span>
          )}
        </>
      }
      empty={health.rows.length === 0 ? `No results entered for ${quarter} yet` : undefined}
      footer={
        <>
          <span className="font-semibold">{more > 0 && `+${more} more`}</span>
          <Link href={href} className="font-bold text-ink hover:underline">
            View all →
          </Link>
        </>
      }
    >
      {shown.map((row) => (
        <ProcessRow key={row.id} row={row} versus={versus} />
      ))}
    </DashboardListCard>
  )
}
