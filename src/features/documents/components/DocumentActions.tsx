"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { GitBranch, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import ChangeRequestDialog from "./ChangeRequestDialog"
import { resubmitChangeRequest } from "@/features/documents/mutations"

/** The "Request a change" entrance on the document page. */
export function RequestChangeButton({ documentId, documentName }: { documentId: string; documentName: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9" onClick={() => setOpen(true)}>
        <GitBranch className="h-4 w-4" />
        Request a change
      </Button>
      {open && <ChangeRequestDialog documentId={documentId} documentName={documentName} onClose={() => setOpen(false)} />}
    </>
  )
}

/** Shown on a rejected request the viewer raised. */
export function ResubmitButton({ requestId }: { requestId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-zinc-800">
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
