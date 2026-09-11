"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { saveKpiMeasurement } from "@/features/kpis/mutations"
import type { KpiTrackingRow } from "@/features/kpis/queries"
import type { PeriodEntryState } from "@/features/periods/queries"

export default function MeasurementDialog({
  kpi,
  period,
  periodLabel,
  onClose,
}: {
  kpi: KpiTrackingRow
  period: PeriodEntryState
  /** "Q3 2026" — for the title and the success toast. */
  periodLabel: string
  onClose: () => void
}) {
  const [value, setValue] = useState(kpi.actualValue?.toString() ?? "")
  const [notMeasured, setNotMeasured] = useState(kpi.notMeasured)
  const [remark, setRemark] = useState(kpi.justification ?? "")
  const [evidence, setEvidence] = useState(kpi.evidence ?? "")
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    const actualValue = notMeasured ? null : Number(value)
    if (!notMeasured && (value.trim() === "" || Number.isNaN(actualValue))) {
      toast.error("Enter a numeric actual value, or mark the KPI as not measured.")
      return
    }

    startTransition(async () => {
      const result = await saveKpiMeasurement({
        kpiId: kpi.id!,
        reportingPeriodId: period.id,
        actualValue,
        notMeasured,
        remark,
        evidenceReference: evidence,
      })
      if (result.ok) {
        toast.success(`Measurement for "${kpi.name}" saved for ${periodLabel}.`)
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 space-y-5">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 mt-0.5">
            <Activity className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Log Measurement · {periodLabel}</h2>
            <p className="text-sm text-muted-foreground truncate" title={kpi.name}>{kpi.name}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Target: <strong className="text-slate-700 dark:text-slate-300">{kpi.target || "—"}</strong>
            </p>
          </div>
        </div>

        {/* Actual value + unit */}
        <div className="space-y-2">
          <Label htmlFor="measurement-value">Actual value</Label>
          <div className="flex items-center gap-2">
            <Input
              id="measurement-value"
              type="number"
              inputMode="decimal"
              step="any"
              value={value}
              disabled={notMeasured || pending}
              placeholder={notMeasured ? "Not measured" : "e.g., 92.5"}
              onChange={(e) => setValue(e.target.value)}
              className="bg-white dark:bg-zinc-950"
            />
            {kpi.unit && (
              <span className="shrink-0 text-sm text-muted-foreground font-mono px-2 py-1.5 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                {kpi.unit}
              </span>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
              checked={notMeasured}
              disabled={pending}
              onChange={(e) => {
                setNotMeasured(e.target.checked)
                if (e.target.checked) setValue("")
              }}
            />
            Not measured this period
          </label>
        </div>

        {/* Remark */}
        <div className="space-y-2">
          <Label htmlFor="measurement-remark">Remark / justification</Label>
          <textarea
            id="measurement-remark"
            className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            placeholder="Context, or why the target was missed…"
            value={remark}
            disabled={pending}
            onChange={(e) => setRemark(e.target.value)}
          />
        </div>

        {/* Evidence */}
        <div className="space-y-2">
          <Label htmlFor="measurement-evidence">Evidence reference</Label>
          <Input
            id="measurement-evidence"
            value={evidence}
            disabled={pending}
            placeholder="e.g., Jira dashboard link, report file name"
            onChange={(e) => setEvidence(e.target.value)}
            className="bg-white dark:bg-zinc-950"
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t dark:border-zinc-800">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={pending}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {pending ? "Saving…" : "Save Measurement"}
          </Button>
        </div>
      </div>
    </div>
  )
}
