"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { recordDecision } from "@/features/documents/mutations"
import { ChangeRequestCard } from "./ChangeRequestCard"
import type { ChangeRequestItem, ApprovalStage } from "@/features/documents/queries"

const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

/**
 * One request from a queue: its contents, the decisions so far, and the
 * reviewer's own decision. Reject needs a reason before it is sent.
 */
export default function DecisionPanel({
  request,
  stage,
}: {
  request: ChangeRequestItem
  stage: ApprovalStage
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  const decide = (decision: "approved" | "rejected") => {
    if (decision === "rejected" && reason.trim() === "") {
      toast.error("Give a reason for the rejection.")
      return
    }
    startTransition(async () => {
      const r = await recordDecision({ requestId: request.id, stage, decision, reason })
      if (r.ok) {
        toast.success(
          decision === "approved"
            ? `Approved. "${request.documentName}" ${stage === "owner" ? "moves to IMS review." : `is now at ${request.proposedRevision}.`}`
            : `Rejected and returned to ${request.requesterName ?? "the requester"}.`
        )
      } else {
        toast.error(r.message)
      }
    })
  }

  return (
    <ChangeRequestCard request={request} showDocument>
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
        {rejecting && (
          <div className="space-y-2">
            <Label htmlFor={`reject-${request.id}`}>Reason for rejection <span className="text-rose-500">*</span></Label>
            <textarea
              id={`reject-${request.id}`}
              className={textareaClass}
              value={reason}
              disabled={pending}
              placeholder="What must change before this can be approved…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {rejecting ? (
            <>
              <Button variant="outline" onClick={() => { setRejecting(false); setReason("") }} disabled={pending}>Cancel</Button>
              <Button variant="destructive" onClick={() => decide("rejected")} disabled={pending} className="gap-2">
                <XCircle className="h-4 w-4" />
                {pending ? "Rejecting…" : "Confirm rejection"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setRejecting(true)} disabled={pending} className="gap-2 text-rose-700 dark:text-rose-400">
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
              <Button onClick={() => decide("approved")} disabled={pending} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {pending ? "Approving…" : "Approve"}
              </Button>
            </>
          )}
        </div>
      </div>
    </ChangeRequestCard>
  )
}
