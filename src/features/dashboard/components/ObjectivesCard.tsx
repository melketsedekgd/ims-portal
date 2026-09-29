import Link from "next/link"
import { cn } from "@/lib/utils"
import { DashboardListCard } from "@/features/dashboard/components/DashboardListCard"
import type {
  ObjectiveProgress,
  ObjectiveProgressRow,
  ObjectiveProgressStatus,
} from "@/features/dashboard/objective-progress"

const MAX_ROWS = 4

const LABEL: Record<ObjectiveProgressStatus, string> = {
  behind: "Behind",
  not_entered: "Not entered",
  not_measured: "N/A",
  on_track: "On track",
  complete: "Complete",
  achieved: "Achieved",
}

const LABEL_TONE: Record<ObjectiveProgressStatus, string> = {
  behind: "text-status-bad",
  not_entered: "text-ink",
  not_measured: "text-ink",
  on_track: "text-ink",
  complete: "text-status-good",
  achieved: "text-status-good",
}

/** No fill without a figure: not entered and N/A draw an empty track. */
const BAR_FILL: Record<ObjectiveProgressStatus, string | null> = {
  behind: "bg-status-bad",
  not_entered: null,
  not_measured: null,
  on_track: "bg-ink/55",
  complete: "bg-status-good",
  achieved: "bg-status-good",
}

function ObjectiveRow({ row }: { row: ObjectiveProgressRow }) {
  const fill = BAR_FILL[row.status]
  return (
    <li className="flex flex-col gap-1.5 border-b border-ink/8 py-1.5 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-semibold leading-5 text-ink" title={row.title}>
          {row.title}
        </span>
        <span className={cn("shrink-0 text-xs font-bold", LABEL_TONE[row.status])}>
          {LABEL[row.status]}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="relative h-2 flex-1 rounded-full bg-status-pending">
          {fill && row.actual !== null && (
            <div
              className={cn("h-full rounded-full", fill)}
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
          {row.actual !== null ? `${row.actual}%` : row.status === "not_measured" ? "N/A" : "—"}
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
          {progress.onTrack > 0 && <span className="text-ink">{progress.onTrack} on track</span>}
          {progress.achieved > 0 && (
            <span className="text-status-good">{progress.achieved} achieved</span>
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
