import Link from "next/link"
import { ArrowLeft, Layers, Target, History, ShieldAlert } from "lucide-react"
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
import type { KpiDetail as KpiDetailData, KpiHistoryRow } from "@/features/kpis/queries"
import type { KpiStatus } from "@/features/kpis/types"

function StatusBadge({ status }: { status: KpiStatus }) {
  switch (status) {
    case "Achieved":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Achieved</Badge>
    case "Deviated":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Deviated</Badge>
    case "Pending":
      return <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
    case "Not Measured":
      return <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-zinc-800 dark:text-zinc-400 shadow-none border-transparent">Not Measured</Badge>
  }
}

const FREQUENCY: Record<Enums<"period_type">, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
}
const DIRECTION: Record<Enums<"target_direction">, string> = {
  higher_is_better: "Higher is better",
  lower_is_better: "Lower is better",
  exact: "Exact match",
}
const AGGREGATION: Record<Enums<"aggregation_method">, string> = {
  average: "Average",
  sum: "Sum",
  min: "Minimum",
  max: "Maximum",
  latest: "Latest",
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
      <dd className="text-sm text-slate-900 dark:text-slate-100">{children ?? "—"}</dd>
    </div>
  )
}

/**
 * Achievement for one history row. Three states that must not look alike:
 * a recorded N/A, a measurement the ratio functions could not score (unit
 * mismatch — shown blank, never 0%), and a scored value.
 */
function Achievement({ row }: { row: KpiHistoryRow }) {
  if (row.notMeasured) return <span className="text-muted-foreground">N/A</span>
  if (row.achievementRatio === null) return null
  return (
    <span className="inline-flex items-center gap-1.5 font-medium">
      {pct(row.achievementRatio)}
      {row.override && (
        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 dark:border-amber-700 dark:text-amber-400">
          Overridden
        </Badge>
      )}
    </span>
  )
}

/**
 * Read-only KPI definition and measurement history. Nothing here writes;
 * measurements are recorded from the tracking page and definitions are
 * created at /department/kpis/new.
 */
export default function KpiDetail({
  kpi,
  backHref,
}: {
  kpi: KpiDetailData
  /** Tracking page with the period the user came from, so Back returns there. */
  backHref: string
}) {
  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-[1400px] mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Link
          href={backHref}
          className={`${buttonVariants({ variant: "ghost", size: "icon" })} shrink-0 mt-0.5`}
          aria-label="Back to KPIs"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[11px] font-medium uppercase tracking-widest text-slate-500 bg-slate-50 dark:bg-zinc-900">
              <Layers className="h-3 w-3 mr-1" />
              {kpi.processName}
            </Badge>
            {kpi.department && (
              <Badge variant="outline" className="text-[11px] font-medium text-slate-500 bg-slate-50 dark:bg-zinc-900" title={kpi.department.name}>
                {kpi.department.code}
              </Badge>
            )}
            {kpi.status === "retired" && (
              <Badge variant="outline" className="text-[11px] text-muted-foreground">Retired</Badge>
            )}
          </div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {kpi.name}
          </h1>
          {kpi.description && (
            <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{kpi.description}</p>
          )}
        </div>
      </div>

      {/* ── Definition ── */}
      <section className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl p-5 md:p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
            <Target className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Definition</h2>
            <p className="text-xs text-muted-foreground">
              The target as written on the report, and the parsed value scoring uses.
            </p>
          </div>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
          <Field label="Target (as reported)">{kpi.targetText}</Field>
          <Field label="Target (for scoring)">
            {kpi.targetValue != null ? (
              <span className="font-mono">
                {kpi.targetValue}{kpi.targetUnit ? ` ${kpi.targetUnit}` : ""}
              </span>
            ) : null}
          </Field>
          <Field label="Direction">{DIRECTION[kpi.targetDirection]}</Field>
          <Field label="Measurement frequency">{FREQUENCY[kpi.measurementFrequency]}</Field>
          <Field label="Reporting frequency">{FREQUENCY[kpi.reportingFrequency]}</Field>
          <Field label="Aggregation">{AGGREGATION[kpi.aggregationMethod]}</Field>
          <Field label="Data source">{kpi.dataSource}</Field>
          <Field label="Responsibility">{kpi.responsibilityTitle}</Field>
          <Field label="Created">
            {fmtDate(kpi.createdAt)}{kpi.createdBy ? ` by ${kpi.createdBy}` : ""}
          </Field>
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Analysis methodology">{kpi.analysisMethodology}</Field>
          </div>
        </dl>
      </section>

      {/* ── History ── */}
      <section className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 p-5 md:px-6 border-b border-slate-200 dark:border-zinc-800">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
            <History className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight">Measurement history</h2>
            <p className="text-xs text-muted-foreground">
              One row per period with a recorded measurement. Targets are the snapshot each period was scored against.
            </p>
          </div>
        </div>

        {kpi.history.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No measurements have been recorded for this KPI.</p>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
              <TableRow>
                <TableHead className="h-10 pl-6">Period</TableHead>
                <TableHead className="h-10">Actual</TableHead>
                <TableHead className="h-10">Target</TableHead>
                <TableHead className="h-10">Achievement</TableHead>
                <TableHead className="h-10">Status</TableHead>
                <TableHead className="h-10">Remark</TableHead>
                <TableHead className="h-10">Evidence</TableHead>
                <TableHead className="h-10 pr-6">Recorded</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpi.history.map((row) => (
                <HistoryRows key={row.id} row={row} />
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  )
}

function HistoryRows({ row }: { row: KpiHistoryRow }) {
  return (
    <>
      <TableRow className={row.override ? "border-b-0" : undefined}>
        <TableCell className="pl-6 font-medium whitespace-nowrap">{row.period}</TableCell>
        <TableCell className="font-semibold">
          {row.notMeasured ? <span className="text-muted-foreground font-normal">N/A</span> : row.actual || "—"}
        </TableCell>
        <TableCell className="font-mono text-sm">{row.targetSnapshot || "—"}</TableCell>
        <TableCell><Achievement row={row} /></TableCell>
        <TableCell><StatusBadge status={row.status} /></TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-[280px]" title={row.remark ?? undefined}>
          <span className="line-clamp-2">{row.remark || "—"}</span>
        </TableCell>
        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={row.evidence ?? undefined}>
          {row.evidence || "—"}
        </TableCell>
        <TableCell className="pr-6 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(row.recordedAt)}</TableCell>
      </TableRow>

      {/* Override disclosure: the achievement above is a number a manager
          set, not one the measurement produced. Say so, say who and when,
          give the reason, and show the computed value it replaced. */}
      {row.override && (
        <TableRow className="bg-amber-50/60 dark:bg-amber-950/20 hover:bg-amber-50/60 dark:hover:bg-amber-950/20">
          <TableCell colSpan={8} className="pl-6 pr-6 py-3">
            <div className="flex gap-3 text-sm">
              <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="space-y-1 text-amber-900 dark:text-amber-200">
                <p>
                  <span className="font-semibold">Achievement overridden to {pct(row.override.value)}.</span>{" "}
                  Computed from the measurement:{" "}
                  <span className="font-mono">
                    {row.override.computed !== null ? pct(row.override.computed) : "not scoreable"}
                  </span>
                  . Set by {row.override.by ?? "an unrecorded user"}
                  {row.override.at ? ` on ${fmtDate(row.override.at)}` : ", date not recorded"}.
                </p>
                <p className="text-amber-800/90 dark:text-amber-300/80">
                  <span className="font-medium">Reason:</span>{" "}
                  {row.override.reason || <em>none recorded</em>}
                </p>
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
