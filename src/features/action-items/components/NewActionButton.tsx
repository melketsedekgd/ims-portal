"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
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
import { createAction } from "@/features/action-items/mutations"
import type { Enums } from "@/types/database"

const PRIORITY_LABEL: Record<string, string> = { "1": "Low", "2": "Medium", "3": "High" }

export type ActionSource = {
  type: Enums<"action_source">
  id: string
  departmentId: string
  /** e.g. "this risk", "this KPI" — shown so the user knows where it lands. */
  label: string
}

/**
 * The "New action" entrance. On a risk/KPI/objective detail page, pass
 * `source` and department_id/source_type/source_id are set without being
 * typed — no picker for them is shown. On the standalone actions list,
 * `source` is omitted: source_type is fixed at 'other' and the user picks
 * a department from the ones they can create actions in.
 */
export default function NewActionButton({
  departments,
  source,
}: {
  departments: { id: string; name: string; code: string }[]
  source?: ActionSource
}) {
  const [open, setOpen] = useState(false)

  if (!source && departments.length === 0) return null

  return (
    <>
      <Button className="gap-2 h-9" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        New action
      </Button>
      {open && (
        <NewActionDialog departments={departments} source={source} onClose={() => setOpen(false)} />
      )}
    </>
  )
}

function NewActionDialog({
  departments,
  source,
  onClose,
}: {
  departments: { id: string; name: string; code: string }[]
  source?: ActionSource
  onClose: () => void
}) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [ownerTitle, setOwnerTitle] = useState("")
  const [priority, setPriority] = useState("")
  const [startDate, setStartDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (title.trim() === "") {
      toast.error("Title is required.")
      return
    }
    const targetDepartmentId = source?.departmentId ?? departmentId
    if (!targetDepartmentId) {
      toast.error("Choose a department.")
      return
    }

    startTransition(async () => {
      const result = await createAction({
        departmentId: targetDepartmentId,
        sourceType: source?.type ?? "other",
        sourceId: source?.id ?? null,
        title,
        description: description || undefined,
        ownerTitle: ownerTitle || undefined,
        priority: priority ? Number(priority) : undefined,
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
      })
      if (result.ok) {
        toast.success("Action created.")
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <div>
          <h2 className="text-lg font-bold tracking-tight">New action</h2>
          {source && (
            <p className="text-sm text-muted-foreground mt-1">From {source.label}.</p>
          )}
        </div>

        {!source && (
          <div className="space-y-2">
            <Label htmlFor="action-department">Department</Label>
            <Select
              value={departmentId}
              onValueChange={(v) => v && setDepartmentId(v)}
              disabled={pending}
            >
              <SelectTrigger id="action-department" className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Choose a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="action-title">Title</Label>
          <Input
            id="action-title"
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs to happen"
            className="bg-white dark:bg-slate-950"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="action-description">Description</Label>
          <textarea
            id="action-description"
            className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            value={description}
            disabled={pending}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="action-owner">Owner (job title)</Label>
            <Input
              id="action-owner"
              value={ownerTitle}
              disabled={pending}
              onChange={(e) => setOwnerTitle(e.target.value)}
              placeholder="e.g., IT Manager"
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v ?? "")} disabled={pending}>
              <SelectTrigger id="action-priority" className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="action-start">Start date</Label>
            <Input
              id="action-start"
              type="date"
              value={startDate}
              disabled={pending}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="action-due">Due date</Label>
            <Input
              id="action-due"
              type="date"
              value={dueDate}
              disabled={pending}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t dark:border-slate-800">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Creating…" : "Create action"}
          </Button>
        </div>
      </div>
    </div>
  )
}

export { PRIORITY_LABEL }
