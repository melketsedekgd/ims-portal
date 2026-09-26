"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { GitBranch, RotateCcw, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import ChangeRequestDialog, { type DocumentOption } from "./ChangeRequestDialog"
import type {
  ChangeRequestItem,
  DocumentTypeOption,
  RequestableDepartment,
  WorkflowSettingsItem,
} from "@/features/documents/queries"
import { resubmitChangeRequest, submitDraft } from "@/features/documents/mutations"

/**
 * The "Request a change" entrance. On the register it opens with the
 * document combobox free; on a document's page, fixed to that document.
 */
export function RequestChangeButton({
  documents,
  departments,
  documentTypes,
  workflowSettings,
  defaultDepartmentId,
  fixedDocument,
}: {
  documents: DocumentOption[]
  departments: RequestableDepartment[]
  documentTypes: DocumentTypeOption[]
  workflowSettings: WorkflowSettingsItem[]
  defaultDepartmentId: string | null
  fixedDocument?: DocumentOption
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button className="gap-2 h-9" onClick={() => setOpen(true)}>
        <GitBranch className="h-4 w-4" />
        Request a change
      </Button>
      {open && (
        <ChangeRequestDialog
          documents={documents}
          departments={departments}
          documentTypes={documentTypes}
          workflowSettings={workflowSettings}
          defaultDepartmentId={defaultDepartmentId}
          fixedDocument={fixedDocument}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

/** Shown on a rejected request the viewer raised. */
export function ResubmitButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-800">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        className="gap-2"
        onClick={() =>
          startTransition(async () => {
            const r = await resubmitChangeRequest(requestId)
            if (r.ok) toast.success("Request resubmitted to the document owner.")
            else toast.error(r.message)
          })
        }
      >
        <RotateCcw className="h-3.5 w-3.5" />
        {pending ? "Resubmitting…" : "Resubmit for review"}
      </Button>
    </div>
  )
}

const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

/**
 * Shown to the requester on their own request while it is awaiting_draft or
 * draft_returned. On a return, the draft_check rejection's reason is shown
 * above the box — the most recent one, since a draft can be returned more
 * than once.
 */
export function SendDraftBox({ request }: { request: ChangeRequestItem }) {
  const [fileUrl, setFileUrl] = useState("")
  const [note, setNote] = useState("")
  const [pending, startTransition] = useTransition()

  const returnReason =
    request.status === "draft_returned"
      ? [...request.approvals].reverse().find((a) => a.stage === "draft_check" && a.decision === "rejected")?.reason ?? null
      : null

  const submit = () => {
    if (fileUrl.trim() === "") {
      toast.error("A draft needs a file link.")
      return
    }
    startTransition(async () => {
      const r = await submitDraft({ requestId: request.id, fileUrl, note })
      if (r.ok) {
        toast.success("Draft sent for review.")
        setFileUrl("")
        setNote("")
      } else {
        toast.error(r.message)
      }
    })
  }

  return (
    <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
      {returnReason && (
        <p className="rounded-md border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-900/20 px-3 py-2 text-sm text-rose-800 dark:text-rose-300">
          <span className="font-medium">Returned: </span>{returnReason}
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor={`draft-file-${request.id}`}>Draft file link <span className="text-rose-500">*</span></Label>
        <Input
          id={`draft-file-${request.id}`}
          type="url"
          value={fileUrl}
          disabled={pending}
          placeholder="OneDrive / SharePoint link"
          onChange={(e) => setFileUrl(e.target.value)}
          className="bg-white dark:bg-slate-950"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`draft-note-${request.id}`}>Note</Label>
        <textarea
          id={`draft-note-${request.id}`}
          className={textareaClass}
          value={note}
          disabled={pending}
          placeholder="Optional — anything the reviewer should know"
          onChange={(e) => setNote(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <Button className="gap-2" onClick={submit} disabled={pending}>
          <Send className="h-4 w-4" />
          {pending ? "Sending…" : "Send draft"}
        </Button>
      </div>
    </div>
  )
}
