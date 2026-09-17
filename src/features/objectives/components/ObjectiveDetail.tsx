import Link from "next/link"
import { ArrowLeft, Layers, Target, ListChecks, History, CheckCircle2, Circle, CircleDot, XCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Enums } from "@/types/database"
import type {
  ObjectiveDetail as ObjectiveDetailData,
  ObjectiveHistoryRow,
  ObjectiveLifecycle,
} from "@/features/objectives/queries"
import { PILL, OBJECTIVE_LIFECYCLE } from "@/components/shared/status-styles"

function StatusBadge({ status }: { status: ObjectiveLifecycle }) {
  return <span className={`${PILL} ${OBJECTIVE_LIFECYCLE[status]}`}>{status}</span>
}

const ACTIVITY_STATUS: Record<Enums<"activity_status">, { label: string; icon: React.ReactNode }> = {
  completed: { label: "Completed", icon: <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> },
  in_progress: { label: "In progress", icon: <CircleDot className="h-4 w-4 text-ink" /> },
  not_started: { label: "Not started", icon: <Circle className="h-4 w-4 text-slate-400" /> },
  cancelled: { label: "Cancelled", icon: <XCircle className="h-4 w-4 text-slate-400" /> },
}

// Fixed locale and zone: rendered on the server, and a report date should not
// move with whichever machine happens to render it.
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })

const pct = (ratio: number) => `${Math.round(ratio * 100)}%`

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-line">{children ?? "—"}</dd>
    </div>
  )
}

function SectionHeader({
  icon,
  tone,
  title,
  description,
}: {
  icon: React.ReactNode
  tone: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${tone}`}>{icon}</div>
      <div>
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/**
 * Achievement for one history row.
 *
 * A recorded N/A is an answer, never 0%. The "N of M" line appears only when
 * the snapshot carries counts — an objective with no activities has its
 * achievement entered directly and both counts null, so the line is simply
 * absent rather than reading "0 of 0".
 */
function Achievement({ row }: { row: ObjectiveHistoryRow }) {
  if (row.notMeasured) return <span className="text-muted-foreground">N/A</span>
  if (row.achievement === null) return <span className="text-muted-foreground">—</span>
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-semibold tabular-nums">{pct(row.achievement)}</span>
      {row.activitiesTotal !== null && (
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {row.activitiesCompleted ?? 0} of {row.activitiesTotal} activities
        </span>
      )}
    </div>
  )
}

/**
 * Read-only objective definition, activity list and measurement history.
 * Nothing here writes; measurements are recorded from the objectives page.
 */
export default function ObjectiveDetail({
  objective,
  backHref,
}: {
  objective: ObjectiveDetailData
  /** Objectives page with the period the user came from, so Back returns there. */
  backHref: string
}) {
  const hasActivities = objective.activities.length > 0

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-[1440px] mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Link
          href={backHref}
          className={`${buttonVariants({ variant: "ghost", size: "icon" })} shrink-0 mt-0.5`}
          aria-label="Back to objectives"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            {/* A null process is a decision, not a gap: IT's endpoint security
                objective sits under none. No badge rather than "General". */}
            {objective.processName !== null && (
              <Badge variant="outline" className="text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-900">
                <Layers className="h-3 w-3 mr-1" />
                {objective.processName}
              </Badge>
            )}
            {objective.department && (
              <Badge variant="outline" className="text-[11px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-900" title={objective.department.name}>
                {objective.department.code}
              </Badge>
            )}
            <StatusBadge status={objective.status} />
          </div>
          <h1 className="text-lg md:text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100 max-w-[75ch]">
            {objective.title}
          </h1>
          {objective.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{objective.description}</p>
          )}
        </div>
      </div>

      {/* ── Definition ── */}
      <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <SectionHeader
            icon={<Target className="h-4 w-4" />}
            tone="bg-slate-100 text-ink-2"
            title="Definition"
            description="The objective as written on the report."
          />
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5">
          <Field label="Owner">{objective.ownerTitle}</Field>
          <Field label="Start">{objective.startDate ? fmtDate(objective.startDate) : null}</Field>
          <Field label="Target">{objective.targetDate ? fmtDate(objective.targetDate) : null}</Field>
          <Field label="Reference">{objective.referenceNumber}</Field>
          <Field label="Created">{fmtDate(objective.createdAt)}</Field>
          <Field label="Achievement">
            {hasActivities
              ? "Completed activities ÷ total, snapshotted at each measurement"
              : "Entered directly at each measurement"}
          </Field>
        </dl>
      </section>

      {/* ── Activities ──
          Rendered only for objectives that have them. An objective without
          activities scores by direct entry; showing an empty list here would
          suggest the score is derived from nothing. */}
      {hasActivities && (
        <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
          <div className="p-5 md:px-6 border-b border-slate-200 dark:border-slate-800">
            <SectionHeader
              icon={<ListChecks className="h-4 w-4" />}
              tone="bg-slate-100 text-ink-2"
              title="Activities"
              description="Live status today. Each period's score below is the count as it stood when that period was recorded."
            />
          </div>
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {objective.activities.map((a, i) => {
              const s = ACTIVITY_STATUS[a.status]
              const cancelled = a.status === "cancelled"
              return (
                <li key={a.id} className="flex items-start gap-3 px-5 md:px-6 py-3">
                  <span className="mt-0.5 shrink-0">{s.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm ${cancelled ? "line-through text-muted-foreground" : "text-slate-900 dark:text-slate-100"}`}>
                      <span className="text-muted-foreground tabular-nums mr-2">{i + 1}.</span>
                      {a.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s.label}
                      {a.completedDate ? ` · ${fmtDate(a.completedDate)}` : ""}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* ── History ── */}
      <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 md:px-6 border-b border-slate-200 dark:border-slate-800">
          <SectionHeader
            icon={<History className="h-4 w-4" />}
            tone="bg-slate-100 text-ink-2"
            title="Measurement history"
            description="One row per period with a recorded measurement, as it was reported at the time."
          />
        </div>

        {objective.history.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No measurements have been recorded for this objective.</p>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="h-10 pl-6">Period</TableHead>
                <TableHead className="h-10">Achievement</TableHead>
                <TableHead className="h-10">Evidence</TableHead>
                <TableHead className="h-10">Reason for deviation</TableHead>
                <TableHead className="h-10">Follow-up action</TableHead>
                <TableHead className="h-10 pr-6">Recorded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {objective.history.map((row) => (
                <TableRow key={row.id} className="align-top">
                  <TableCell className="pl-6 font-medium whitespace-nowrap">{row.period}</TableCell>
                  <TableCell><Achievement row={row} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[220px] whitespace-normal">
                    {row.evidenceReference || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[320px] whitespace-normal">
                    {row.reasonForDeviation || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[320px] whitespace-normal">
                    {row.followupAction || "—"}
                  </TableCell>
                  <TableCell className="pr-6 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(row.recordedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}
