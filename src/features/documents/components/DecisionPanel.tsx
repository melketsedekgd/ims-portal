"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { SIGNOFF_ACTION } from "@/components/shared/status-styles"
import { recordDecision } from "@/features/documents/mutations"
import { ChangeRequestCard } from "./ChangeRequestCard"
import type { ChangeRequestItem } from "@/features/documents/queries"
import type { DecisionInput } from "@/features/documents/schema"

type DecidableStage = DecisionInput["stage"]

const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

/** What the two buttons say, by stage — the decision is always approved/rejected underneath. */
const STAGE_ACTION: Record<DecidableStage, { approve: string; reject: string }> = {
  owner: { approve: "Approve", reject: "Return" },
  coordinator_review: { approve: "Forward to IMS Manager", reject: "Return to requester" },
  extra_review: { approve: "Approve", reject: "Return" },
  ims: { approve: "Approve", reject: "Return" },
  draft_check: { approve: "No edits needed", reject: "Needs edits" },
  ims_document: { approve: "Approve", reject: "Return" },
  final: { approve: "Approve", reject: "Return" },
}

/**
 * One request from a queue: its contents, the decisions so far, and the
 * reviewer's own decision. Reject needs a reason before it is sent.
 */
export default function DecisionPanel({
  request,
  stage,
}: {
  request: ChangeRequestItem
  stage: DecidableStage
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState("")
  const [pending, startTransition] = useTransition()

  const { approve: approveLabel, reject: rejectLabel } = STAGE_ACTION[stage]

  const decide = (decision: "approved" | "rejected") => {
    if (decision === "rejected" && reason.trim() === "") {
      toast.error("Give a reason.")
      return
    }
    startTransition(async () => {
      const r = await recordDecision({ requestId: request.id, stage, decision, reason })
      if (r.ok) {
        toast.success(
          decision === "approved"
            ? `"${request.documentName}" moved forward.`
            : `Returned to ${request.requesterName ?? "the requester"}.`
        )
      } else {
        toast.error(r.message)
      }
    })
  }

  return (
    <ChangeRequestCard request={request} showDocument collapsible>
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
        {rejecting && (
          <div className="space-y-2">
            <Label htmlFor={`reject-${request.id}`}>Reason <span className="text-rose-500">*</span></Label>
            <textarea
              id={`reject-${request.id}`}
              className={textareaClass}
              value={reason}
              disabled={pending}
              placeholder="What must change…"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {rejecting ? (
            <>
              <Button variant="outline" onClick={() => { setRejecting(false); setReason("") }} disabled={pending}>Cancel</Button>
              <Button variant="outline" className={`gap-2 ${SIGNOFF_ACTION.danger}`} onClick={() => decide("rejected")} disabled={pending}>
                <XCircle className="h-4 w-4" />
                {pending ? "Sending…" : `Confirm: ${rejectLabel}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className={`gap-2 ${SIGNOFF_ACTION.danger}`} onClick={() => setRejecting(true)} disabled={pending}>
                <XCircle className="h-4 w-4" />
                {rejectLabel}
              </Button>
              <Button variant="outline" className={`gap-2 ${SIGNOFF_ACTION.success}`} onClick={() => decide("approved")} disabled={pending}>
                <CheckCircle2 className="h-4 w-4" />
                {pending ? "Sending…" : approveLabel}
              </Button>
            </>
          )}
        </div>
      </div>
    </ChangeRequestCard>
  )
}
