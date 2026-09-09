"use client"

import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Target, BarChart3, ShieldAlert } from "lucide-react"

import type { PeriodSnapshot } from "@/features/reports/queries"

type Bucket = { label: string; count: number }

function MetricRow({
  icon,
  iconClass,
  title,
  total,
  unit,
  buckets,
}: {
  icon: React.ReactNode
  iconClass: string
  title: string
  total: number
  unit: string
  buckets: Bucket[]
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-md border bg-slate-50 dark:bg-zinc-900/50">
      <div className="flex items-start gap-3 min-w-0">
        <div className={`p-2 rounded-md shrink-0 ${iconClass}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          {total === 0 ? (
            <p className="text-xs text-muted-foreground">
              No {unit} recorded for this period.
            </p>
          ) : (
            // Every bucket is listed, including the empty ones. A period with
            // nothing entered should read as "44 Pending", not as an absence.
            <p className="text-xs text-muted-foreground">
              {buckets.map((b, i) => (
                <span key={b.label}>
                  {i > 0 && <span className="mx-1.5 text-muted-foreground/50">·</span>}
                  <span className="tabular-nums font-medium text-slate-700 dark:text-slate-300">
                    {b.count}
                  </span>{" "}
                  {b.label}
                </span>
              ))}
            </p>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="text-lg font-bold tabular-nums leading-none">{total}</p>
        <p className="text-[11px] text-muted-foreground mt-1">{unit}</p>
      </div>
    </div>
  )
}

export default function PeriodSnapshotPanel({
  period,
  snapshot,
  preparedBy,
  onCancel,
}: {
  period: string
  snapshot: PeriodSnapshot
  preparedBy: string
  onCancel: () => void
}) {
  const { kpis, risks, objectives } = snapshot

  return (
    <div className="space-y-8">

      {/* ── Data Snapshot ── */}
      <div className="space-y-3">
        <Label className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">
          Data Snapshot ({period})
        </Label>
        <div className="grid grid-cols-1 gap-3">
          <MetricRow
            icon={<Target className="h-4 w-4" />}
            iconClass="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
            title="Objective Progress"
            total={objectives.total}
            unit="objectives"
            // Lifecycle and outcome, not On Track / At Risk / Off Track — those
            // three labels have no column behind them.
            buckets={[
              { label: "measured", count: objectives.measured },
              { label: "not measured", count: objectives.notMeasured },
              { label: "completed earlier", count: objectives.completedEarlier },
              { label: "not reported", count: objectives.notReported },
            ]}
          />
          <MetricRow
            icon={<BarChart3 className="h-4 w-4" />}
            iconClass="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
            title="KPI Performance"
            total={kpis.total}
            unit="KPIs"
            buckets={[
              { label: "achieved", count: kpis.achieved },
              { label: "deviated", count: kpis.deviated },
              { label: "pending", count: kpis.pending },
            ]}
          />
          <MetricRow
            icon={<ShieldAlert className="h-4 w-4" />}
            iconClass="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
            title="Risk Register"
            total={risks.total}
            unit="risks"
            buckets={[
              { label: "critical", count: risks.critical },
              { label: "medium", count: risks.medium },
              { label: "low", count: risks.low },
              { label: "not assessed", count: risks.notAssessed },
            ]}
          />
        </div>
        {/* The previous version of this line claimed the figures were pulled
            from department records while they were hardcoded strings. They are
            now genuinely counted — but they are counted live, not frozen, and
            saying so is the part that matters on an audit page. */}
        <p className="text-xs text-muted-foreground">
          Counted from this department&apos;s objective, KPI and risk records for{" "}
          {period} at the moment this page loaded. These figures are not a fixed
          copy — they change if the underlying measurements are edited later.
        </p>
      </div>

      {/* ── Prepared By ── */}
      <div className="space-y-3">
        <Label className="text-muted-foreground uppercase tracking-wider text-xs font-semibold">
          Prepared By
        </Label>
        <div className="p-3 rounded-md border bg-slate-50 dark:bg-zinc-900/50 text-sm font-medium">
          {preparedBy}
        </div>
      </div>

      {/* The executive summary field and the Save Draft / Publish buttons are
          gone with the rest of the write layer. They set local state and fired
          a toast; the summary was discarded on close and Publish appended a
          fabricated row to the archive. */}
      <div className="mt-8 flex items-center justify-end gap-3 pt-6 border-t dark:border-zinc-800">
        <Button variant="outline" onClick={onCancel} className="w-full">
          Close
        </Button>
      </div>
    </div>
  )
}
