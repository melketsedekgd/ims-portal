"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Archive, FileCheck2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SIGNOFF_ACTION } from "@/components/shared/status-styles"
import { publishChangeRequest, retireDocument } from "@/features/documents/mutations"
import { ChangeRequestCard } from "./ChangeRequestCard"
import type { ChangeRequestItem } from "@/features/documents/queries"

/**
 * Document control publishing a new document or revision. Prefilled from
 * the request: revision from proposedRevision, the final file from the
 * latest draft, effective date from proposedEffectiveDate — all still
 * editable, since the published record does not have to match the draft
 * exactly (a typo caught at the last read, say).
 */
export function PublishForm({ request }: { request: ChangeRequestItem }) {
  const [revisionLabel, setRevisionLabel] = useState(request.proposedRevision ?? "")
  const [documentNumber, setDocumentNumber] = useState("")
  const [fileUrl, setFileUrl] = useState(request.drafts[0]?.fileUrl ?? "")
  const [effectiveDate, setEffectiveDate] = useState(request.proposedEffectiveDate ?? "")
  const [pending, startTransition] = useTransition()

  const submit = () => {
    startTransition(async () => {
      const r = await publishChangeRequest({ requestId: request.id, revisionLabel, documentNumber, fileUrl, effectiveDate })
      if (r.ok) toast.success(`"${request.documentName}" published.`)
      else toast.error(r.message)
    })
  }

  return (
    <ChangeRequestCard request={request} showDocument collapsible>
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`pub-revision-${request.id}`}>Revision <span className="text-rose-500">*</span></Label>
            <Input id={`pub-revision-${request.id}`} value={revisionLabel} disabled={pending} onChange={(e) => setRevisionLabel(e.target.value)} className="bg-white dark:bg-slate-950" />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`pub-number-${request.id}`}>Document number</Label>
            <Input id={`pub-number-${request.id}`} value={documentNumber} disabled={pending} placeholder="Leave blank to keep the current number" onChange={(e) => setDocumentNumber(e.target.value)} className="bg-white dark:bg-slate-950" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`pub-file-${request.id}`}>Final file <span className="text-rose-500">*</span></Label>
          <Input id={`pub-file-${request.id}`} type="url" value={fileUrl} disabled={pending} placeholder="OneDrive / SharePoint link" onChange={(e) => setFileUrl(e.target.value)} className="bg-white dark:bg-slate-950" />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`pub-date-${request.id}`}>Effective date</Label>
          <Input id={`pub-date-${request.id}`} type="date" value={effectiveDate} disabled={pending} onChange={(e) => setEffectiveDate(e.target.value)} className="bg-white dark:bg-slate-950 w-fit" />
        </div>
        <div className="flex justify-end">
          <Button variant="outline" className={`gap-2 ${SIGNOFF_ACTION.success}`} onClick={submit} disabled={pending}>
            <FileCheck2 className="h-4 w-4" />
            {pending ? "Publishing…" : "Publish"}
          </Button>
        </div>
      </div>
    </ChangeRequestCard>
  )
}

/** Document control retiring a document approved for deletion. */
export function RetireButton({ request }: { request: ChangeRequestItem }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const submit = () => {
    startTransition(async () => {
      const r = await retireDocument({ requestId: request.id })
      if (r.ok) toast.success(`"${request.documentName}" retired.`)
      else toast.error(r.message)
    })
  }

  return (
    <ChangeRequestCard request={request} showDocument collapsible>
      <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-end gap-3">
        {confirming ? (
          <>
            <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
            <Button variant="outline" className={`gap-2 ${SIGNOFF_ACTION.danger}`} onClick={submit} disabled={pending}>
              <Archive className="h-4 w-4" />
              {pending ? "Retiring…" : "Confirm retirement"}
            </Button>
          </>
        ) : (
          <Button variant="outline" className={`gap-2 ${SIGNOFF_ACTION.danger}`} onClick={() => setConfirming(true)} disabled={pending}>
            <Archive className="h-4 w-4" />
            Retire document
          </Button>
        )}
      </div>
    </ChangeRequestCard>
  )
}
