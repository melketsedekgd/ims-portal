"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Lock, ChevronDown } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { recordQuarterDecision } from "@/features/signoff/mutations"
import type { HeaderSignoff } from "@/features/signoff/queries"

/**
 * Sign-off lives in the dashboard header because sign-off is a state of the
 * quarter, and the quarter already has a home. It uses PageHeader's existing
 * slots and adds no section of its own: a badge beside the Live pill, one
 * subtitle line, and at most two buttons shown only to whoever's turn it is.
 *
 * Which buttons appear is a hint. record_quarter_decision() is the authority
 * and re-checks the caller, the state and completeness on every call.
 */

/** Same shape as the Live badge: rounded-full outline, px-3 py-1, text-sm. */
const BADGE = "gap-2 px-3 py-1 text-sm font-medium rounded-full"
const WARNING = "border-amber-200 bg-amber-50 text-amber-800"
const DANGER = "border-rose-200 bg-rose-50 text-rose-700"
const NEUTRAL = "border-slate-300 bg-slate-100 text-slate-700"

const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

function shortDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function SignoffBadge({ signoff }: { signoff: HeaderSignoff | null }) {
  if (!signoff) return null

  switch (signoff.status) {
    case "returned":
      return <Badge variant="outline" className={`${BADGE} ${DANGER}`}>Returned</Badge>
    case "submitted":
      return (
        <Badge variant="outline" className={`${BADGE} ${WARNING}`}>
          <Lock className="h-3.5 w-3.5" />
          {signoff.canDecide ? "Awaiting your approval" : "Submitted"}
        </Badge>
      )
    case "approved":
      return (
        <Badge variant="outline" className={`${BADGE} ${WARNING}`}>
          <Lock className="h-3.5 w-3.5" />
          Approved
        </Badge>
      )
    case "received":
      return (
        <Badge variant="outline" className={`${BADGE} ${NEUTRAL}`}>
          <Lock className="h-3.5 w-3.5" />
          Signed off
        </Badge>
      )
    default:
      return null
  }
}

export function SignoffSubtitle({
  signoff,
  fallback,
}: {
  signoff: HeaderSignoff | null
  fallback: string
}) {
  if (!signoff) return <>{fallback}</>

  // A quarter that ended without being signed is worth saying on whichever
  // quarter the user is actually looking at.
  const nudge = signoff.unsignedEarlier ? (
    <>
      {" · "}
      <Link
        href={`/department?year=${signoff.unsignedEarlier.year}&quarter=${signoff.unsignedEarlier.label}`}
        className="underline underline-offset-2 hover:text-foreground"
      >
        Go to {signoff.unsignedEarlier.label}
      </Link>
    </>
  ) : null

  // An unsigned quarter that has already ended outranks anything about the
  // quarter being looked at, as long as that one has not been submitted yet.
  if (signoff.unsignedEarlier && signoff.status === "open") {
    return (
      <>
        {signoff.unsignedEarlier.label} {signoff.unsignedEarlier.year} hasn&rsquo;t been signed off
        {nudge}
      </>
    )
  }

  switch (signoff.status) {
    case "returned":
      return (
        <>
          <span className="text-rose-700 dark:text-rose-400">
            {signoff.returnReason ?? "Returned for changes"}
          </span>
          {signoff.returnedBy && <> · returned by {signoff.returnedBy}</>}
          {" · "}
          <MissingOrReady signoff={signoff} />
          {nudge}
        </>
      )
    case "submitted":
      return (
        <>
          Submitted by {signoff.submittedBy ?? "—"}
          {signoff.canDecide
            ? ` · ${shortDate(signoff.submittedAt)}`
            : " · waiting for approval"}
          {nudge}
        </>
      )
    case "approved":
      return (
        <>
          Prepared by {signoff.submittedBy ?? "—"} · Approved by {signoff.approvedBy ?? "—"}
          {signoff.samePerson && <> · prepared and approved by the same person</>}
          {nudge}
        </>
      )
    case "received":
      return (
        <>
          Prepared, approved and received · {shortDate(signoff.receivedAt)}
          {nudge}
        </>
      )
    default:
      return signoff.canSubmit ? (
        <>
          <MissingOrReady signoff={signoff} />
          {nudge}
        </>
      ) : (
        <>{fallback}</>
      )
  }
}

function MissingOrReady({ signoff }: { signoff: HeaderSignoff }) {
  if (!signoff.canSubmit) return null

  if (signoff.missing.length === 0) {
    return <>All {signoff.quarter} figures entered</>
  }

  const period = `?year=${signoff.year}&quarter=${signoff.quarter}`
  const kpis = signoff.missing.filter((m) => m.kind === "kpi")
  const objectives = signoff.missing.filter((m) => m.kind === "objective")

  return (
    <>
      {signoff.missing.length} figure{signoff.missing.length === 1 ? "" : "s"} still missing for{" "}
      {signoff.quarter}
      {" · "}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
            >
              Show which
              <ChevronDown className="h-3 w-3" />
            </button>
          }
        />
        <DropdownMenuContent align="start" className="w-80 max-h-96 overflow-y-auto">
          {kpis.length > 0 && (
            <>
              <DropdownMenuLabel>KPIs ({kpis.length})</DropdownMenuLabel>
              {kpis.map((m) => (
                <DropdownMenuItem
                  key={m.itemId}
                  render={
                    <Link href={`/department/kpis/${m.itemId}${period}`}>
                      <span className="line-clamp-1">{m.name}</span>
                    </Link>
                  }
                />
              ))}
            </>
          )}
          {objectives.length > 0 && (
            <>
              {kpis.length > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>Objectives ({objectives.length})</DropdownMenuLabel>
              {objectives.map((m) => (
                <DropdownMenuItem
                  key={m.itemId}
                  render={
                    <Link href={`/department/objectives/${m.itemId}${period}`}>
                      <span className="line-clamp-1">{m.name}</span>
                    </Link>
                  }
                />
              ))}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )
}

export function SignoffActions({ signoff }: { signoff: HeaderSignoff | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dialog, setDialog] = useState<null | "submit" | "approve" | "receive" | "return">(null)
  const [reason, setReason] = useState("")

  if (!signoff) return null

  const run = (decision: "submit" | "return" | "approve" | "receive", ok: string) => {
    startTransition(async () => {
      const r = await recordQuarterDecision({
        departmentId: signoff.departmentId,
        periodId: signoff.periodId,
        decision,
        reason: decision === "return" ? reason : undefined,
      })
      if (r.ok) {
        toast.success(ok)
        setDialog(null)
        setReason("")
        router.refresh()
      } else {
        toast.error(r.message)
      }
    })
  }

  const showSubmit = signoff.canSubmit && signoff.missing.length === 0
  const showDecide = signoff.status === "submitted" && signoff.canDecide
  const showReceive = signoff.status === "approved" && signoff.canReceive

  if (!showSubmit && !showDecide && !showReceive) return null

  return (
    <>
      {showSubmit && (
        <Button className="h-9" disabled={pending} onClick={() => setDialog("submit")}>
          Submit {signoff.quarter}
        </Button>
      )}

      {showDecide && (
        <>
          <Button
            variant="outline"
            className="h-9 bg-white"
            disabled={pending}
            onClick={() => setDialog("return")}
          >
            Return
          </Button>
          <Button className="h-9" disabled={pending} onClick={() => setDialog("approve")}>
            Approve
          </Button>
        </>
      )}

      {showReceive && (
        <Button className="h-9" disabled={pending} onClick={() => setDialog("receive")}>
          Mark received
        </Button>
      )}

      <Confirm
        open={dialog === "submit"}
        onClose={() => setDialog(null)}
        title={`Submit ${signoff.quarter}?`}
        description={`Submitting locks ${signoff.quarter} figures until your manager approves or returns them.`}
        confirmLabel={pending ? "Submitting…" : `Submit ${signoff.quarter}`}
        pending={pending}
        onConfirm={() => run("submit", `${signoff.quarter} submitted for review.`)}
      />

      <Confirm
        open={dialog === "approve"}
        onClose={() => setDialog(null)}
        title={`Approve ${signoff.quarter}?`}
        description="The figures stay locked and the quarter goes to IMS to be received. Returning it is the only way to make them editable again."
        confirmLabel={pending ? "Approving…" : "Approve"}
        pending={pending}
        onConfirm={() => run("approve", "Approved. IMS can now receive it.")}
      />

      <Confirm
        open={dialog === "receive"}
        onClose={() => setDialog(null)}
        title={`Mark ${signoff.quarter} received?`}
        description="This closes the department's sign-off for the quarter. The figures stay locked."
        confirmLabel={pending ? "Receiving…" : "Mark received"}
        pending={pending}
        onConfirm={() => run("receive", "Received. The quarter is closed.")}
      />

      <Dialog open={dialog === "return"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return {signoff.quarter} to the department?</DialogTitle>
            <DialogDescription>
              The figures become editable again and whoever submitted them is notified.
            </DialogDescription>
          </DialogHeader>
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={pending || reason.trim() === ""}
              onClick={() => run("return", "Returned to the department.")}
            >
              {pending ? "Returning…" : "Confirm return"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Confirm({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  title: string
  description: string
  confirmLabel: string
  pending: boolean
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
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
