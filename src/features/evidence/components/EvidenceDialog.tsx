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
import { addEvidence } from "@/features/evidence/mutations"
import type { Enums } from "@/types/database"

const TYPE_LABEL: Record<Enums<"evidence_type">, string> = {
  document: "Document",
  link: "Link",
  screenshot: "Screenshot",
  report: "Report",
  ticket: "Ticket",
  other: "Other",
}

/**
 * The "Add evidence" entrance, embedded on a risk/KPI/objective/action
 * detail page. No department picker: department_id is resolved server-side
 * from (linkedType, linkedId), not typed or chosen here.
 */
export default function EvidenceDialog({
  linkedType,
  linkedId,
  path,
}: {
  linkedType: Enums<"action_source">
  linkedId: string
  /** The page to revalidate on success. */
  path: string
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [type, setType] = useState<Enums<"evidence_type">>("other")
  const [location, setLocation] = useState("")
  const [pending, startTransition] = useTransition()

  const handleSave = () => {
    if (name.trim() === "") {
      toast.error("Name is required.")
      return
    }
    startTransition(async () => {
      const result = await addEvidence(
        { linkedType, linkedId, name, type, location: location || undefined },
        path
      )
      if (result.ok) {
        toast.success("Evidence added.")
        setOpen(false)
        setName("")
        setLocation("")
        setType("other")
      } else {
        toast.error(result.message)
      }
    })
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 h-8 text-xs"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3.5 w-3.5" />
        Add evidence
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200 space-y-5">
            <h2 className="text-lg font-bold tracking-tight">Add evidence</h2>

            <div className="space-y-2">
              <Label htmlFor="evidence-name">Name</Label>
              <Input
                id="evidence-name"
                value={name}
                disabled={pending}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Patch compliance report"
                className="bg-white dark:bg-slate-950"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as Enums<"evidence_type">)}
                disabled={pending}
              >
                <SelectTrigger id="evidence-type" className="w-full bg-white dark:bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABEL).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence-location">Location</Label>
              <Input
                id="evidence-location"
                value={location}
                disabled={pending}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Link or file reference"
                className="bg-white dark:bg-slate-950"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t dark:border-slate-800">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? "Adding…" : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
