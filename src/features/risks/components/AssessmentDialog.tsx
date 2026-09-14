"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Gauge } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { saveRiskAssessment } from "@/features/risks/mutations"
import type { RiskListItem } from "@/features/risks/queries"
import type { PeriodEntryState } from "@/features/periods/queries"
import { riskBand, RISK_BAND_LABEL } from "@/features/risks/scoring"

const toRating = (s: string) => {
  const n = Number(s)
  return s.trim() !== "" && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null
}

/**
 * Records the residual rating for one risk in the selected period. Baselines
 * are pre-treatment and period-less; they are not edited here.
 */
export default function AssessmentDialog({
  risk,
  period,
  periodLabel,
  onClose,
}: {
  risk: RiskListItem
  period: PeriodEntryState
  /** "Q3 2026" — for the title and the success toast. */
  periodLabel: string
  onClose: () => void
}) {
  const [severity, setSeverity] = useState(risk.severity?.toString() ?? "")
  const [likelihood, setLikelihood] = useState(risk.likelihood?.toString() ?? "")
  const [notes, setNotes] = useState("")
  const [pending, startTransition] = useTransition()

  const sev = toRating(severity)
  const lik = toRating(likelihood)
  // Preview only. The stored rpn is the generated column; this just lets the
  // user see the band before saving, using the same thresholds the table uses.
  const preview = sev !== null && lik !== null ? sev * lik : null
  const band = riskBand(preview)

  const handleSave = () => {
    if (sev === null || lik === null) {
      toast.error("Enter a severity and a likelihood from 1 to 5.")
      return
    }
    startTransition(async () => {
      const result = await saveRiskAssessment({
        riskId: risk.id,
        reportingPeriodId: period.id,
        severity: sev,
        likelihood: lik,
        notes,
      })
      if (result.ok) {
        toast.success(`Residual rating for "${risk.title}" saved for ${periodLabel}.`)
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
          <div className="p-1.5 rounded-lg bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-400 mt-0.5">
            <Gauge className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Residual Rating · {periodLabel}</h2>
            <p className="text-sm text-muted-foreground truncate" title={risk.title}>{risk.title}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="assessment-severity">Severity (1–5)</Label>
            <Input
              id="assessment-severity"
              type="number"
              inputMode="numeric"
              min={1}
              max={5}
              step={1}
              value={severity}
              disabled={pending}
              placeholder="1–5"
              onChange={(e) => setSeverity(e.target.value)}
              className="bg-white dark:bg-zinc-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assessment-likelihood">Likelihood (1–5)</Label>
            <Input
              id="assessment-likelihood"
              type="number"
              inputMode="numeric"
              min={1}
              max={5}
              step={1}
              value={likelihood}
              disabled={pending}
              placeholder="1–5"
              onChange={(e) => setLikelihood(e.target.value)}
              className="bg-white dark:bg-zinc-950"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Score:</span>
          {preview === null ? (
            <span>—</span>
          ) : (
            <Badge variant="outline" className="tabular-nums font-semibold">
              {preview} · {RISK_BAND_LABEL[band]}
            </Badge>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="assessment-notes">Notes</Label>
          <textarea
            id="assessment-notes"
            className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            placeholder="What changed since the last rating…"
            value={notes}
            disabled={pending}
            onChange={(e) => setNotes(e.target.value)}
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
            {pending ? "Saving…" : "Save Rating"}
          </Button>
        </div>
      </div>
    </div>
  )
}
