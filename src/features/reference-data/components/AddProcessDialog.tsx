"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { CircleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { ProcessOption } from "@/features/kpis/queries"
import { createProcess } from "../mutations"

/**
 * Active processes whose name contains the typed one or is contained by it,
 * ignoring case. The list the dialog is given is already active-only
 * (getProcessesForDepartments), which is the set the unique index checks.
 */
function closeMatches(name: string, existing: ProcessOption[]): ProcessOption[] {
  const typed = name.trim().toLowerCase()
  if (!typed) return []
  return existing.filter((p) => {
    const other = p.name.trim().toLowerCase()
    return other.includes(typed) || typed.includes(other)
  })
}

/**
 * The dialog behind "+ Add process…". Mount it only while open, so every
 * opening starts blank.
 *
 * Before saving, a close match among the department's processes is offered
 * instead ("Did you mean …?"); picking it selects the existing process and
 * creates nothing. Saving anyway is one more click.
 */
export default function AddProcessDialog({
  departmentId,
  departmentName,
  existing,
  onCreated,
  onPicked,
  onClose,
}: {
  departmentId: string
  departmentName: string
  /** The department's active processes. */
  existing: ProcessOption[]
  onCreated: (process: ProcessOption) => void
  /** An existing process chosen from "Did you mean …?". */
  onPicked: (process: ProcessOption) => void
  onClose: () => void
}) {
  const [name, setName] = useState("")
  const [governingDocument, setGoverningDocument] = useState("")
  const [nameError, setNameError] = useState<string | null>(null)
  const [banner, setBanner] = useState<string | null>(null)
  // The matches shown for the name as it was when Save was pressed. Editing
  // the name clears them, so the next Save checks again.
  const [suggestions, setSuggestions] = useState<ProcessOption[] | null>(null)
  const [pending, startTransition] = useTransition()

  const changeName = (v: string) => {
    setName(v)
    setNameError(null)
    setSuggestions(null)
  }

  const save = (skipMatchCheck: boolean) => {
    if (!name.trim()) {
      setNameError("Give the process a name")
      return
    }
    if (!skipMatchCheck) {
      const matches = closeMatches(name, existing)
      if (matches.length > 0) {
        setSuggestions(matches)
        return
      }
    }

    setBanner(null)
    startTransition(async () => {
      const result = await createProcess({ departmentId, name, governingDocument })
      if (result.ok) {
        toast.success(`Process "${result.process.name}" added.`)
        onCreated(result.process)
      } else {
        setBanner(result.message)
      }
    })
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-48px)] flex-col gap-0 p-0 sm:max-w-[480px]">
        <DialogHeader className="shrink-0 gap-1 px-6 pt-5 pb-3 pr-12">
          <DialogTitle className="text-lg font-semibold">Add process</DialogTitle>
          <DialogDescription>A new process in {departmentName}, added at the end of its list.</DialogDescription>
        </DialogHeader>

        <form
          id="add-process-form"
          className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 pt-2 pb-5"
          onSubmit={(e) => {
            e.preventDefault()
            // Once the matches are showing, saving again means "add it anyway".
            save(suggestions !== null)
          }}
        >
          {banner && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
            >
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{banner}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="process-name">
              Name <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="process-name"
              autoFocus
              value={name}
              disabled={pending}
              onChange={(e) => changeName(e.target.value)}
              aria-invalid={nameError ? true : undefined}
              aria-describedby={nameError ? "process-name-error" : undefined}
              className="bg-white dark:bg-slate-950"
            />
            {nameError && (
              <p id="process-name-error" className="text-xs text-rose-600 dark:text-rose-400">
                {nameError}
              </p>
            )}
          </div>

          {suggestions && suggestions.length > 0 && (
            <div
              role="status"
              className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
            >
              {suggestions.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3">
                  <span>
                    Did you mean <span className="font-medium">{p.name}</span>?
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={pending}
                    onClick={() => onPicked(p)}
                  >
                    Use this one
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="process-document">
              Governing document <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Input
              id="process-document"
              placeholder="The procedure or policy this process follows"
              value={governingDocument}
              disabled={pending}
              onChange={(e) => setGoverningDocument(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
        </form>

        <DialogFooter className="m-0 shrink-0 px-6 py-3.5">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="add-process-form" disabled={pending}>
            {pending ? "Adding…" : suggestions ? `Add "${name.trim()}" anyway` : "Add process"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
