"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { SquarePen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { updateActionStatus } from "@/features/action-items/mutations"
import type { Action } from "@/features/action-items/queries"
import type { Enums } from "@/types/database"

const STATUS_LABEL: Record<Enums<"action_status">, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
}

export default function UpdateActionStatusButton({ action }: { action: Action }) {
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<Enums<"action_status">>(action.status)
  const [completionPercentage, setCompletionPercentage] = useState(
    action.completionPercentage?.toString() ?? ""
  )
  const [completedDate, setCompletedDate] = useState(action.completedDate ?? "")
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (status === "completed" && !completedDate) {
      toast.error("Completed date is required when marking an action complete.")
      return
    }

    startTransition(async () => {
      const result = await updateActionStatus({
        id: action.id,
        status,
        completionPercentage: completionPercentage ? Number(completionPercentage) : undefined,
        completedDate: status === "completed" ? completedDate : undefined,
      })
      if (result.ok) {
        toast.success(`"${action.title}" updated.`)
        setOpen(false)
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-slate-400 hover:text-[var(--ink)] hover:bg-slate-100 dark:hover:bg-slate-800"
        title="Update status"
        onClick={() => setOpen(true)}
      >
        <SquarePen className="h-4 w-4" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200 space-y-5">
            <div>
              <h2 className="text-lg font-bold tracking-tight">Update action</h2>
              <p className="text-sm text-muted-foreground mt-1 truncate" title={action.title}>
                {action.title}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="update-status">Status</Label>
              <Select
                value={status}
                onValueChange={(v) => v && setStatus(v as Enums<"action_status">)}
                disabled={pending}
              >
                <SelectTrigger id="update-status" className="w-full bg-white dark:bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="update-completion">Completion %</Label>
              <Input
                id="update-completion"
                type="number"
                min={0}
                max={100}
                value={completionPercentage}
                disabled={pending}
                onChange={(e) => setCompletionPercentage(e.target.value)}
                className="bg-white dark:bg-slate-950"
              />
            </div>

            {status === "completed" && (
              <div className="space-y-2">
                <Label htmlFor="update-completed-date">Completed date</Label>
                <Input
                  id="update-completed-date"
                  type="date"
                  value={completedDate}
                  disabled={pending}
                  onChange={(e) => setCompletedDate(e.target.value)}
                  className="bg-white dark:bg-slate-950"
                />
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2 border-t dark:border-slate-800">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
