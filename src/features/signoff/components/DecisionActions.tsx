"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { CheckCircle2, Undo2, Inbox } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { recordQuarterDecision } from "@/features/signoff/mutations"
import type { SignoffStatus } from "@/features/signoff/queries"

const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

/**
 * The decisions available from here, shown only to the people who may take
 * them. That is a hint about what to render — record_quarter_decision()
 * decides what actually happens, and it checks the caller itself.
 *
 * Approve and Received confirm first because both lock the quarter: after
 * either one, nobody can change a figure without the quarter being returned.
 */
export default function DecisionActions({
  departmentId,
  periodId,
  status,
  canDecide,
  canReceive,
  canResubmit,
  year,
  quarter,
}: {
  departmentId: string
  periodId: string
  status: SignoffStatus
  canDecide: boolean
  canReceive: boolean
  canResubmit: boolean
  year: number
  quarter: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [confirm, setConfirm] = useState<null | "approve" | "receive">(null)
  const [returning, setReturning] = useState(false)
  const [reason, setReason] = useState("")

  const run = (decision: "return" | "approve" | "receive", ok: string) => {
    startTransition(async () => {
      const r = await recordQuarterDecision({
        departmentId,
        periodId,
        decision,
        reason: decision === "return" ? reason : undefined,
      })
      if (r.ok) {
        toast.success(ok)
        setConfirm(null)
        setReturning(false)
        setReason("")
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })
  }

  if (status === "returned" && canResubmit) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50/50 dark:border-rose-900 dark:bg-rose-950/20 p-4">
        <p className="text-sm text-ink">
          This quarter was returned. The figures are editable again — fix them, then
          submit it a second time.
        </p>
        <Button
          variant="outline"
          className="mt-3"
          render={<Link href={`/sign-off?year=${year}&quarter=${quarter}`}>Fix and resubmit</Link>}
        />
      </div>
    )
  }

  if (status === "submitted" && canDecide) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
        {returning && (
          <div className="space-y-2">
            <Label htmlFor="return-reason">
              Why is this going back? <span className="text-rose-500">*</span>
            </Label>
            <textarea
              id="return-reason"
              className={textareaClass}
              value={reason}
              disabled={pending}
              placeholder="What must change before this quarter can be approved…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-end gap-3">
          {returning ? (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => {
                  setReturning(false)
                  setReason("")
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={pending || reason.trim() === ""}
                onClick={() => run("return", "Returned to the department.")}
                className="gap-2"
              >
                <Undo2 className="h-4 w-4" />
                {pending ? "Returning…" : "Confirm return"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                disabled={pending}
                onClick={() => setReturning(true)}
                className="gap-2 text-rose-700 dark:text-rose-400"
              >
                <Undo2 className="h-4 w-4" />
                Return
              </Button>
              <Button
                disabled={pending}
                onClick={() => setConfirm("approve")}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </Button>
            </>
          )}
        </div>

        <ConfirmDialog
          open={confirm === "approve"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Approve this quarter?"
          description="The figures stay locked and the quarter goes to IMS to be received. Returning it is the only way to make them editable again."
          confirmLabel={pending ? "Approving…" : "Approve"}
          pending={pending}
          onConfirm={() => run("approve", "Approved. IMS can now receive it.")}
        />
      </div>
    )
  }

  if (status === "approved" && canReceive) {
    return (
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Approved by the department and waiting for IMS to receive it.
        </p>
        <Button disabled={pending} onClick={() => setConfirm("receive")} className="gap-2">
          <Inbox className="h-4 w-4" />
          Mark received
        </Button>

        <ConfirmDialog
          open={confirm === "receive"}
          onOpenChange={(o) => !o && setConfirm(null)}
          title="Receive this quarter?"
          description="This closes the department's sign-off for the quarter. The figures stay locked."
          confirmLabel={pending ? "Receiving…" : "Mark received"}
          pending={pending}
          onConfirm={() => run("receive", "Received. The quarter is closed.")}
        />
      </div>
    )
  }

  return null
}

function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
