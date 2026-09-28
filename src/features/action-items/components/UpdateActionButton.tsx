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
import { updateAction } from "@/features/action-items/mutations"
import { ACTION_PRIORITY_LABEL, ACTION_STATUS_LABEL } from "@/features/action-items/labels"
import { RelatedItemLink } from "@/features/action-items/components/RelatedItem"
import { actionSourcePeriod, type ActionSourceInfo } from "@/features/action-items/sources"
import type { Action } from "@/features/action-items/queries"
import type { Enums } from "@/types/database"

// Base UI resolves the trigger's label from `items`; without it the
// trigger shows the raw value ("in_progress", "2").
const NO_PRIORITY = "none"
const PRIORITY_ITEMS: Record<string, string> = { [NO_PRIORITY]: "None", ...ACTION_PRIORITY_LABEL }

export default function UpdateActionButton({
  action,
  related,
  fallbackType,
}: {
  action: Action
  related: ActionSourceInfo | null
  /** The source type's label, shown if the view returned nothing. */
  fallbackType: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-slate-400 hover:text-[var(--ink)] hover:bg-slate-100 dark:hover:bg-slate-800"
        title="Update action"
        onClick={() => setOpen(true)}
      >
        <SquarePen className="h-4 w-4" />
      </Button>

      {/* Mounted only while open, so each opening starts from the action
          as it is now, not from an edit that was cancelled. */}
      {open && (
        <UpdateActionDialog
          action={action}
          related={related}
          fallbackType={fallbackType}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}

function UpdateActionDialog({
  action,
  related,
  fallbackType,
  onClose,
}: {
  action: Action
  related: ActionSourceInfo | null
  fallbackType: string
  onClose: () => void
}) {
  const [title, setTitle] = useState(action.title)
  const [ownerTitle, setOwnerTitle] = useState(action.ownerTitle ?? "")
  const [priority, setPriority] = useState(action.priority ? String(action.priority) : NO_PRIORITY)
  const [startDate, setStartDate] = useState(action.startDate ?? "")
  const [dueDate, setDueDate] = useState(action.dueDate ?? "")
  const [status, setStatus] = useState<Enums<"action_status">>(action.status)
  const [completionPercentage, setCompletionPercentage] = useState(
    action.completionPercentage?.toString() ?? ""
  )
  const [completedDate, setCompletedDate] = useState(action.completedDate ?? "")
  const [pending, startTransition] = useTransition()

  const period = related ? actionSourcePeriod(related) : null

  const handleSave = () => {
    if (title.trim() === "") {
      toast.error("Title is required.")
      return
    }
    if (status === "completed" && !completedDate) {
      toast.error("Completed date is required when marking an action complete.")
      return
    }

    startTransition(async () => {
      const result = await updateAction({
        id: action.id,
        title,
        ownerTitle: ownerTitle || undefined,
        priority: priority === NO_PRIORITY ? undefined : Number(priority),
        startDate: startDate || undefined,
        dueDate: dueDate || undefined,
        status,
        completionPercentage: completionPercentage ? Number(completionPercentage) : undefined,
        completedDate: status === "completed" ? completedDate : undefined,
      })
      if (result.ok) {
        toast.success(`"${title.trim()}" updated.`)
        onClose()
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg w-full max-w-lg p-6 animate-in zoom-in-95 duration-200 space-y-5 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-bold tracking-tight">Update action</h2>

        {/* ── What this action belongs to — read-only ── */}
        <section className="rounded-lg border border-border bg-muted/50 p-3 space-y-2 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Related to</p>
          <div>
            <RelatedItemLink source={related} fallbackType={fallbackType} className="font-medium" />
            {period && <p className="text-xs text-muted-foreground">{period}</p>}
          </div>
          {related?.contextReason && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Reason for deviation</p>
              <p className="whitespace-pre-wrap break-words">{related.contextReason}</p>
            </div>
          )}
          {related?.contextFollowup && (
            <div>
              <p className="text-xs font-medium text-muted-foreground">Follow-up as reported</p>
              <p className="whitespace-pre-wrap break-words">{related.contextFollowup}</p>
            </div>
          )}
        </section>

        <div className="space-y-2">
          <Label htmlFor="update-title">Title</Label>
          <Input
            id="update-title"
            value={title}
            disabled={pending}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-white dark:bg-slate-950"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="update-owner">Owner (job title)</Label>
            <Input
              id="update-owner"
              value={ownerTitle}
              disabled={pending}
              onChange={(e) => setOwnerTitle(e.target.value)}
              placeholder="e.g., IT Manager"
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-priority">Priority</Label>
            <Select
              items={PRIORITY_ITEMS}
              value={priority}
              onValueChange={(v) => v && setPriority(v)}
              disabled={pending}
            >
              <SelectTrigger id="update-priority" className="w-full bg-white dark:bg-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PRIORITY_ITEMS).map(([value, label]) => (
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
            <Label htmlFor="update-start">Start date</Label>
            <Input
              id="update-start"
              type="date"
              value={startDate}
              disabled={pending}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="update-due">Due date</Label>
            <Input
              id="update-due"
              type="date"
              value={dueDate}
              disabled={pending}
              onChange={(e) => setDueDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="update-status">Status</Label>
            <Select
              items={ACTION_STATUS_LABEL}
              value={status}
              onValueChange={(v) => v && setStatus(v as Enums<"action_status">)}
              disabled={pending}
            >
              <SelectTrigger id="update-status" className="w-full bg-white dark:bg-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ACTION_STATUS_LABEL).map(([value, label]) => (
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
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
    </div>
  )
}
