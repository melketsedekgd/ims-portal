"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CircleAlert, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { updateTreatment } from "@/features/risks/mutations"
import { treatmentEditSchema, treatmentStatuses } from "@/features/risks/schema"
import type { RiskTreatment } from "@/features/risks/queries"
import type { Enums } from "@/types/database"
import { todayInAddisAbaba } from "@/features/objectives/dates"
import {
  FieldError,
  GrowingTextarea,
  Optional,
  OwnerCombobox,
  Req,
  textareaClass,
  TreatmentStatusToggle,
} from "@/features/risks/components/RiskDefinitionForm"

type Field =
  | "solution"
  | "monitoringEvidence"
  | "ownerTitle"
  | "startDate"
  | "targetDate"
  | "status"
  | "completedDate"
type FieldErrors = Partial<Record<Field, string>>

/**
 * The Edit button on a treatment, and the dialog it opens. Rendered only for
 * a manager of the risk's department or the IMS Manager; the update policy
 * is what enforces that.
 */
export default function EditTreatmentButton({
  treatment,
  ownerTitles,
  departmentName,
}: {
  treatment: RiskTreatment
  /** Owner titles already used in the department's risks. */
  ownerTitles: string[]
  departmentName: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button variant="outline" className="shrink-0 gap-2" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" aria-hidden />
        Edit
      </Button>
      {/* Mounted only while open, so each opening starts from the saved
          treatment rather than from an abandoned edit. */}
      {open && (
        <EditTreatmentDialog
          treatment={treatment}
          ownerTitles={ownerTitles}
          departmentName={departmentName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function EditTreatmentDialog({
  treatment: t,
  ownerTitles,
  departmentName,
  onClose,
}: {
  treatment: RiskTreatment
  ownerTitles: string[]
  departmentName: string
  onClose: () => void
}) {
  const [solution, setSolution] = useState(t.solution)
  const [monitoringEvidence, setMonitoringEvidence] = useState(t.monitoringEvidence ?? "")
  const [ownerTitle, setOwnerTitle] = useState(t.ownerTitle ?? "")
  const [startDate, setStartDate] = useState(t.startDate ?? "")
  const [targetDate, setTargetDate] = useState(t.targetDate ?? "")
  const [status, setStatus] = useState<Enums<"treatment_status">>(t.status)
  const [completedDate, setCompletedDate] = useState(t.completedDate ?? "")

  const [errors, setErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  /** Wraps a setter so editing a field clears its error. */
  const edit =
    <T,>(field: Field, set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
    }

  // A "before the start date" error on the target is about both dates, so
  // moving the start clears it too.
  const changeStartDate = edit("startDate", (v: string) => {
    setStartDate(v)
    setErrors((e) => (e.targetDate ? { ...e, targetDate: undefined } : e))
  })

  // Completed asks for a date; today is the likely answer.
  const changeStatus = edit("status", (s: Enums<"treatment_status">) => {
    setStatus(s)
    if (s === "completed" && !completedDate) setCompletedDate(todayInAddisAbaba())
  })

  const handleSave = () => {
    const parsed = treatmentEditSchema.safeParse({
      treatmentId: t.id,
      solution,
      monitoringEvidence,
      ownerTitle,
      startDate,
      targetDate,
      status,
      completedDate,
    })
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field
        next[field] ??= issue.message
      }
      setErrors(next)
      setBanner(null)
      return
    }

    setErrors({})
    setBanner(null)
    startTransition(async () => {
      const result = await updateTreatment(parsed.data)
      if (result.ok) {
        toast.success("Treatment saved.")
        onClose()
      } else {
        setBanner(result.message)
      }
    })
  }

  const describedBy = (field: Field, hintId?: string) =>
    [errors[field] ? `treatment-${field}-error` : null, hintId].filter(Boolean).join(" ") || undefined

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-48px)] flex-col gap-0 p-0 sm:max-w-[600px]">
        <DialogHeader className="shrink-0 gap-1 px-6 pt-5 pb-3 pr-12">
          <DialogTitle className="text-lg font-semibold">Edit treatment</DialogTitle>
          <DialogDescription>
            How {departmentName} will reduce this risk. Quarterly reviews are recorded from the register.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-2 pb-5">
          {banner && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{banner}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="treatment-solution">Treatment solution <Req /></Label>
            <GrowingTextarea
              id="treatment-solution"
              rows={3}
              className={textareaClass}
              placeholder="What will be done to reduce the risk"
              value={solution}
              disabled={pending}
              onChange={(e) => edit("solution", setSolution)(e.target.value)}
              aria-invalid={errors.solution ? true : undefined}
              aria-describedby={describedBy("solution")}
            />
            <FieldError id="treatment-solution-error" message={errors.solution} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatment-evidence">Monitoring evidence <Optional /></Label>
            <GrowingTextarea
              id="treatment-evidence"
              rows={2}
              className={textareaClass}
              value={monitoringEvidence}
              disabled={pending}
              onChange={(e) => edit("monitoringEvidence", setMonitoringEvidence)(e.target.value)}
              aria-describedby={describedBy("monitoringEvidence", "treatment-evidence-hint")}
            />
            <p id="treatment-evidence-hint" className="text-xs text-muted-foreground">
              Where the proof will be, e.g. a dashboard or a report
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatment-owner">Owner <Optional /></Label>
            <OwnerCombobox
              id="treatment-owner"
              value={ownerTitle}
              onChange={edit("ownerTitle", setOwnerTitle)}
              titles={ownerTitles}
              departmentName={departmentName}
              invalid={!!errors.ownerTitle}
              describedBy={describedBy("ownerTitle", "treatment-owner-hint")}
            />
            <p id="treatment-owner-hint" className="text-xs text-muted-foreground">
              Titles already used in {departmentName}&apos;s risks; type a new one if it isn&apos;t listed
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="treatment-start">Start date <Optional /></Label>
              <Input
                id="treatment-start"
                type="date"
                value={startDate}
                max={targetDate || undefined}
                disabled={pending}
                onChange={(e) => changeStartDate(e.target.value)}
                aria-invalid={errors.startDate ? true : undefined}
                aria-describedby={describedBy("startDate")}
                className="bg-white dark:bg-slate-950"
              />
              <FieldError id="treatment-startDate-error" message={errors.startDate} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="treatment-target">Target date <Req /></Label>
              <Input
                id="treatment-target"
                type="date"
                value={targetDate}
                min={startDate || undefined}
                disabled={pending}
                onChange={(e) => edit("targetDate", setTargetDate)(e.target.value)}
                aria-invalid={errors.targetDate ? true : undefined}
                aria-describedby={describedBy("targetDate")}
                className="bg-white dark:bg-slate-950"
              />
              <FieldError id="treatment-targetDate-error" message={errors.targetDate} />
            </div>
          </div>

          <TreatmentStatusToggle
            id="treatment-status"
            statuses={treatmentStatuses}
            value={status}
            onChange={changeStatus}
          />

          {status === "completed" && (
            <div className="space-y-2 sm:w-1/2 sm:pr-2">
              <Label htmlFor="treatment-completed">Completed date <Req /></Label>
              <Input
                id="treatment-completed"
                type="date"
                value={completedDate}
                disabled={pending}
                onChange={(e) => edit("completedDate", setCompletedDate)(e.target.value)}
                aria-invalid={errors.completedDate ? true : undefined}
                aria-describedby={describedBy("completedDate")}
                className="bg-white dark:bg-slate-950"
              />
              <FieldError id="treatment-completedDate-error" message={errors.completedDate} />
            </div>
          )}
        </div>

        <DialogFooter className="m-0 shrink-0 px-6 py-3.5">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving…" : "Save treatment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
