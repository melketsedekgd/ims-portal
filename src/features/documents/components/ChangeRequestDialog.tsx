"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { GitBranch } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createChangeRequest } from "@/features/documents/mutations"

const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

const Req = () => <span className="text-rose-500">*</span>

/** Raises a change request against one document, straight to the owner's queue. */
export default function ChangeRequestDialog({
  documentId,
  documentName,
  onClose,
}: {
  documentId: string
  documentName: string
  onClose: () => void
}) {
  const [proposedRevision, setProposedRevision] = useState("")
  const [reason, setReason] = useState("")
  const [description, setDescription] = useState("")
  const [affected, setAffected] = useState("")
  const [iso, setIso] = useState("")
  const [effective, setEffective] = useState("")
  const [pending, startTransition] = useTransition()

  const handleSubmit = () => {
    startTransition(async () => {
      const result = await createChangeRequest({
        documentId,
        proposedRevision,
        reasonForChange: reason,
        descriptionOfChange: description,
        affectedProcesses: affected,
        relatedIsoRequirements: iso,
        proposedEffectiveDate: effective,
      })
      if (result.ok) {
        toast.success(`Change request for "${documentName}" sent to the document owner.`)
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-3">
          <div className="p-1.5 rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400 mt-0.5">
            <GitBranch className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-lg font-bold tracking-tight">Request a change</h2>
            <p className="text-sm text-muted-foreground truncate" title={documentName}>{documentName}</p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="cr-revision">Proposed revision <Req /></Label>
          <Input id="cr-revision" value={proposedRevision} disabled={pending} placeholder="e.g., Rev 2" onChange={(e) => setProposedRevision(e.target.value)} className="bg-white dark:bg-zinc-950" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cr-reason">Reason for change <Req /></Label>
          <textarea id="cr-reason" className={textareaClass} value={reason} disabled={pending} placeholder="Why the document needs to change…" onChange={(e) => setReason(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cr-description">Description of change <Req /></Label>
          <textarea id="cr-description" className={textareaClass} value={description} disabled={pending} placeholder="What will be different…" onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="cr-affected">Affected processes</Label>
            <Input id="cr-affected" value={affected} disabled={pending} onChange={(e) => setAffected(e.target.value)} className="bg-white dark:bg-zinc-950" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cr-iso">Related ISO requirements</Label>
            <Input id="cr-iso" value={iso} disabled={pending} placeholder="e.g., 7.5.3" onChange={(e) => setIso(e.target.value)} className="bg-white dark:bg-zinc-950" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cr-effective">Proposed effective date</Label>
          <Input id="cr-effective" type="date" value={effective} disabled={pending} onChange={(e) => setEffective(e.target.value)} className="bg-white dark:bg-zinc-950 w-fit" />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t dark:border-zinc-800">
          <Button variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={pending} className="bg-blue-600 hover:bg-blue-700 text-white">
            {pending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      </div>
    </div>
  )
}
