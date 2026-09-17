"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { GitBranch, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import ChangeRequestDialog, { type DocumentOption } from "./ChangeRequestDialog"
import type { RequestableDepartment } from "@/features/documents/queries"
import { resubmitChangeRequest } from "@/features/documents/mutations"

/**
 * The "Request a change" entrance. On the register it opens with the
 * document combobox free; on a document's page, fixed to that document.
 */
export function RequestChangeButton({
  documents,
  departments,
  defaultDepartmentId,
  fixedDocument,
}: {
  documents: DocumentOption[]
  departments: RequestableDepartment[]
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
