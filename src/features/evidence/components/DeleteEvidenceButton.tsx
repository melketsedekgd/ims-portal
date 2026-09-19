"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { deleteEvidence } from "@/features/evidence/mutations"

export default function DeleteEvidenceButton({ id, path }: { id: string; path: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 shrink-0 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
      disabled={pending}
      title="Delete evidence"
      onClick={() => {
        startTransition(async () => {
          const result = await deleteEvidence(id, path)
          if (!result.ok) toast.error(result.message)
        })
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  )
}
