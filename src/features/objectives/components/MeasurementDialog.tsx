"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  saveObjectiveMeasurement,
  setActivityStatus,
} from "@/features/objectives/mutations"
import type {
  ObjectiveListItem,
  ObjectiveActivity,
} from "@/features/objectives/queries"
import type { PeriodEntryState } from "@/features/periods/queries"

type Progress = "not_started" | "in_progress" | "completed"

const textareaClass =
  "flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

/**
 * Records this period's measurement for one objective.
 *
 * Two modes, decided by whether the objective has any non-cancelled
 * activity — the same test objective_achievement() and the snapshot trigger
 * use:
 *
 *   activities → achievement is DERIVED. The user marks activities; the
 *                percentage shown is a preview of completed / non-cancelled,
 *                and the trigger takes the authoritative snapshot on save.
 *   none       → achievement is ENTERED, as a percentage here and stored
 *                as 0–1. SRD's objectives have no decomposition.
 */
export default function MeasurementDialog({
  objective,
  period,
  periodLabel,
  onClose,
}: {
  objective: ObjectiveListItem
  period: PeriodEntryState
  /** "Q3 2026" — for the title and the success toast. */
  periodLabel: string
  onClose: () => void
}) {
  const stored = objective.measurement
  const activities = objective.activities
  const derived = activities.some((a) => a.status !== "cancelled")

  // Activity mode: the status each activity will be saved with. Unticking a
  // completed activity returns it to not_started; an in_progress activity
  // stays in_progress until ticked.
  const [progress, setProgress] = useState<Record<string, Progress>>(() =>
    Object.fromEntries(
      activities
        .filter((a) => a.status !== "cancelled")
        .map((a) => [a.id, a.status as Progress])
    )
  )
  // Direct mode: percentage in the box, ratio on the wire.
  const [percent, setPercent] = useState(
    stored?.achievement != null ? String(Math.round(stored.achievement * 100)) : ""
  )
  const [notMeasured, setNotMeasured] = useState(stored?.notMeasured ?? false)
  const [evidence, setEvidence] = useState(stored?.evidenceReference ?? "")
  const [deviation, setDeviation] = useState(stored?.reasonForDeviation ?? "")
  const [followup, setFollowup] = useState(stored?.followupAction ?? "")
  const [pending, startTransition] = useTransition()

  const counted = activities.filter((a) => a.status !== "cancelled")
  const completed = counted.filter((a) => progress[a.id] === "completed").length
  const preview = counted.length > 0 ? completed / counted.length : null

  const toggle = (a: ObjectiveActivity, checked: boolean) =>
    setProgress((p) => ({ ...p, [a.id]: checked ? "completed" : "not_started" }))

  const handleSave = () => {
    let achievement: number | null = null
    if (!derived && !notMeasured) {
      const n = Number(percent)
      if (percent.trim() === "" || Number.isNaN(n) || n < 0 || n > 100) {
        toast.error("Enter an achievement from 0 to 100%, or mark the objective as not measured.")
        return
      }
      achievement = n / 100
    }

    startTransition(async () => {
      // Activity changes first, one by one, so the snapshot the measurement
      // trigger takes reflects them. Stop at the first refusal.
      if (derived) {
        for (const a of counted) {
          const next = progress[a.id]
          if (next !== a.status) {
            const r = await setActivityStatus({ activityId: a.id, status: next })
            if (!r.ok) {
              toast.error(r.message)
              return
            }
          }
        }
      }

      const result = await saveObjectiveMeasurement({
        objectiveId: objective.id,
        reportingPeriodId: period.id,
        achievement,
        notMeasured,
        evidenceReference: evidence,
        reasonForDeviation: deviation,
        followupAction: followup,
      })
      if (result.ok) {
        toast.success(`Measurement for "${objective.name}" saved for ${periodLabel}.`)
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  const locked = pending

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 mt-0.5">
            <Target className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Record Progress · {periodLabel}</h2>
            <p className="text-sm text-muted-foreground line-clamp-2" title={objective.name}>{objective.name}</p>
          </div>
        </div>

        {derived ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Activities</Label>
              <span className="text-sm font-semibold tabular-nums" data-testid="derived-achievement">
                {preview === null || notMeasured ? "—" : `${Math.round(preview * 100)}%`}
                <span className="text-xs font-normal text-muted-foreground ml-1.5">
                  {completed} of {counted.length}
                </span>
              </span>
            </div>
            <ul className="rounded-md border border-slate-200 dark:border-zinc-800 divide-y divide-slate-200 dark:divide-zinc-800">
              {activities.map((a) =>
                a.status === "cancelled" ? (
                  <li key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm text-muted-foreground">
                    <span className="h-4 w-4 shrink-0" />
                    <span className="line-through">{a.title}</span>
                    <span className="ml-auto text-[11px] uppercase tracking-wider">cancelled</span>
                  </li>
                ) : (
                  <li key={a.id}>
                    <label className="flex items-center gap-3 px-3 py-2 text-sm cursor-pointer select-none">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-blue-600"
                        checked={progress[a.id] === "completed"}
                        disabled={locked || notMeasured}
                        onChange={(e) => toggle(a, e.target.checked)}
                      />
                      <span className={progress[a.id] === "completed" ? "text-slate-900 dark:text-slate-100" : ""}>
                        {a.title}
                      </span>
                      {progress[a.id] === "in_progress" && (
                        <span className="ml-auto text-[11px] uppercase tracking-wider text-amber-600 dark:text-amber-400">in progress</span>
                      )}
                    </label>
                  </li>
                )
              )}
            </ul>
            <p className="text-xs text-muted-foreground">
              Achievement is derived from completed activities and snapshotted when you save.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="objective-achievement">Achievement</Label>
            <div className="flex items-center gap-2">
              <Input
                id="objective-achievement"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="any"
                value={percent}
                disabled={locked || notMeasured}
                placeholder={notMeasured ? "Not measured" : "e.g., 75"}
                onChange={(e) => setPercent(e.target.value)}
                className="bg-white dark:bg-zinc-950"
              />
              <span className="shrink-0 text-sm text-muted-foreground font-mono px-2 py-1.5 rounded-md bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                %
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              This objective has no activities, so the figure is entered as reported.
            </p>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-blue-600"
            checked={notMeasured}
            disabled={locked}
            onChange={(e) => {
              setNotMeasured(e.target.checked)
              if (e.target.checked) setPercent("")
            }}
          />
          Not measured this period
        </label>

        <div className="space-y-2">
          <Label htmlFor="objective-evidence">Evidence reference</Label>
          <Input
            id="objective-evidence"
            value={evidence}
            disabled={locked}
            placeholder="e.g., report section, ticket, file name"
            onChange={(e) => setEvidence(e.target.value)}
            className="bg-white dark:bg-zinc-950"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="objective-deviation">Reason for deviation</Label>
          <textarea
            id="objective-deviation"
            className={textareaClass}
            placeholder="Why the objective is behind, if it is…"
            value={deviation}
            disabled={locked}
            onChange={(e) => setDeviation(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="objective-followup">Follow-up action</Label>
          <textarea
            id="objective-followup"
            className={textareaClass}
            placeholder="What will be done next…"
            value={followup}
            disabled={locked}
            onChange={(e) => setFollowup(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t dark:border-zinc-800">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending} className="bg-blue-600 hover:bg-blue-700 text-white">
            {pending ? "Saving…" : "Save Progress"}
          </Button>
        </div>
      </div>
    </div>
  )
}
