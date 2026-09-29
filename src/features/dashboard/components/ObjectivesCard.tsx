import Link from "next/link"
import { cn } from "@/lib/utils"
import { DashboardListCard } from "@/features/dashboard/components/DashboardListCard"
import type { ScoreBand } from "@/features/dashboard/heatmap"
import type { ObjectiveProgress, ObjectiveProgressRow } from "@/features/dashboard/objective-progress"
import { DASH_BAR_FILL } from "@/features/dashboard/status"

const MAX_ROWS = 4

const LABEL: Record<ScoreBand, string> = {
  good: "On track",
  warn: "Slightly behind",
  bad: "Behind",
  none: "Not measured",
}

const LABEL_TONE: Record<ScoreBand, string> = {
  good: "text-status-good",
  warn: "text-status-warn",
  bad: "text-status-bad",
  none: "text-ink",
}

function ObjectiveRow({ row }: { row: ObjectiveProgressRow }) {
  return (
    <li className="flex flex-col gap-1.5 border-b border-ink/8 py-1.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold leading-5 text-ink" title={row.title}>
          {row.title}
        </span>
        <span className={cn("shrink-0 text-xs font-bold", LABEL_TONE[row.band])}>
          {LABEL[row.band]}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-2 flex-1 rounded-full bg-status-pending">
          {row.actual !== null && (
            <div
              className={cn("h-full rounded-full", DASH_BAR_FILL[row.band])}
              style={{ width: `${Math.min(row.actual, 100)}%` }}
            />
          )}
          {row.expected !== null && (
            <div
              className="absolute -top-1 h-4 w-0.5 rounded-[1px] bg-ink"
              style={{ left: `calc(${row.expected}% - 1px)` }}
              aria-hidden
            />
          )}
        </div>
        <span className="w-[38px] shrink-0 text-right text-sm font-bold leading-4 tabular-nums text-ink">
          {row.actual !== null ? `${row.actual}%` : row.notMeasured ? "N/A" : "—"}
        </span>
      </div>
    </li>
  )
}

/**
 * The quarter's objectives, the ones needing attention first. Every verdict
 * arrives from objectiveProgress(); this only draws them.
 */
export function ObjectivesCard({
  year,
  quarter,
  progress,
  href,
}: {
  year: string
  quarter: string
  progress: ObjectiveProgress
  /** The objectives list for the same period and department. */
  href: string
}) {
  const shown = progress.rows.slice(0, MAX_ROWS)
  const more = progress.rows.length - shown.length

  return (
    <DashboardListCard
      title="Objectives"
      description={`${quarter} ${year} · against where each should be by now`}
      summary={
        <>
          {progress.behind > 0 && <span className="text-status-bad">{progress.behind} behind</span>}
          {progress.slightlyBehind > 0 && (
            <span className="text-status-warn">{progress.slightlyBehind} slightly behind</span>
          )}
          {progress.onTrack > 0 && (
            <span className="text-status-good">{progress.onTrack} on track</span>
          )}
        </>
      }
      empty={progress.rows.length === 0 ? "Nothing set up" : undefined}
      footer={
        <>
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-0.5 bg-ink" aria-hidden />
            should be by now
          </span>
          <span className="flex items-center gap-3">
            {more > 0 && <span className="font-semibold">+{more} more</span>}
            <Link href={href} className="font-bold text-ink hover:underline">
              View all →
            </Link>
          </span>
        </>
      }
    >
      {shown.map((row) => (
        <ObjectiveRow key={row.id} row={row} />
      ))}
    </DashboardListCard>
  )
}
