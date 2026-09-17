"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Pencil, Plus } from "lucide-react"
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
  DialogTrigger,
} from "@/components/ui/dialog"
import { saveDepartment } from "@/features/admin/mutations"
import {
  formDialogBodyClass,
  formDialogContentClass,
  formDialogFooterClass,
} from "@/features/admin/components/formDialog"
import type { AdminDepartmentItem } from "@/features/admin/queries"

const textareaClass =
  "flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

const Req = () => <span className="text-rose-500">*</span>

/**
 * IMS admin only. Without `department` it creates; with one it edits,
 * status included.
 *
 * A centred dialog, not a slide-out. The button is the dialog's trigger so
 * Base UI returns focus to it on close; the content is a fixed-height
 * column so the header and footer stay put while the fields scroll.
 */
export function DepartmentSheet({ department }: { department?: AdminDepartmentItem }) {
  const [open, setOpen] = useState(false)
  const editing = !!department
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {editing ? (
        <DialogTrigger
          render={<Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-700" title="Edit" aria-label={`Edit ${department.name}`} />}
        >
          <Pencil className="h-4 w-4" />
        </DialogTrigger>
      ) : (
        <DialogTrigger render={<Button className="gap-2 h-9" />}>
          <Plus className="h-4 w-4" />
          New department
        </DialogTrigger>
      )}
      <DialogContent className={formDialogContentClass}>
        <DialogHeader className="pr-8">
          <DialogTitle>{editing ? "Edit department" : "Create department"}</DialogTitle>
          <DialogDescription>
            {editing ? "Name, code, description and whether it is still active." : "A unit that objectives, KPIs and risks are filed under."}
          </DialogDescription>
        </DialogHeader>
        {open && <DepartmentForm department={department} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function DepartmentForm({ department, onDone }: { department?: AdminDepartmentItem; onDone: () => void }) {
  const [name, setName] = useState(department?.name ?? "")
  const [code, setCode] = useState(department?.code ?? "")
  const [description, setDescription] = useState(department?.description ?? "")
  const [status, setStatus] = useState<"active" | "inactive">(department?.status ?? "active")
  const [pending, startTransition] = useTransition()

  const submit = () =>
    startTransition(async () => {
      const r = await saveDepartment({ id: department?.id, name, code, description, status })
      if (r.ok) {
        toast.success(department ? `${name} updated.` : `${name} created.`)
        onDone()
      } else {
        toast.error(r.message)
      }
    })

  return (
    <>
      <div className={formDialogBodyClass}>
        <div className="space-y-2">
          <Label htmlFor="dp-name">Name <Req /></Label>
          <Input id="dp-name" value={name} disabled={pending} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dp-code">Code <Req /></Label>
          <Input id="dp-code" value={code} disabled={pending} placeholder="e.g., IT" className="font-mono uppercase" onChange={(e) => setCode(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dp-description">Description</Label>
          <textarea id="dp-description" className={textareaClass} value={description} disabled={pending} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {department && (
          <div className="space-y-2">
            <Label>Status</Label>
            <div className="flex gap-2">
              {(["active", "inactive"] as const).map((s) => (
                <Button key={s} type="button" variant={status === s ? "default" : "outline"} size="sm" disabled={pending} onClick={() => setStatus(s)} className={status === s ? "bg-slate-800 text-white hover:bg-slate-700" : ""}>
                  {s === "active" ? "Active" : "Inactive"}
                </Button>
              ))}
            </div>
            {status === "inactive" && (
              <p className="text-xs text-muted-foreground">Retired, not deleted. Its records stay attached to it.</p>
            )}
          </div>
        )}
      </div>

      <DialogFooter className={formDialogFooterClass}>
        <Button variant="outline" onClick={onDone} disabled={pending}>Cancel</Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : department ? "Save changes" : "Create department"}
        </Button>
      </DialogFooter>
    </>
  )
}
