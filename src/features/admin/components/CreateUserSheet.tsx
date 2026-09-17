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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createUser } from "@/features/admin/mutations"
import {
  formDialogBodyClass,
  formDialogContentClass,
  formDialogFooterClass,
} from "@/features/admin/components/formDialog"
import { ISSUABLE_ROLES, isDepartmentScoped, type IssuableRoleKey } from "@/features/admin/schema"

const Req = () => <span className="text-rose-500">*</span>

/**
 * IMS admin only — the page does not render this for anyone else.
 *
 * A centred dialog, not a slide-out. The button is the dialog's trigger so
 * Base UI returns focus to it on close; the content is a fixed-height
 * column so the header and footer stay put while the fields scroll.
 */
export function CreateUserSheet({ departments }: { departments: { id: string; name: string; code: string }[] }) {
  const [open, setOpen] = useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button className="gap-2 h-9" />}>
        <Plus className="h-4 w-4" />
        New user
      </DialogTrigger>
      <DialogContent className={formDialogContentClass}>
        <DialogHeader className="pr-8">
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>An account they sign in to with the temporary password, and one role.</DialogDescription>
        </DialogHeader>
        {open && <CreateUserForm departments={departments} onDone={() => setOpen(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CreateUserForm({
  departments,
  onDone,
}: {
  departments: { id: string; name: string; code: string }[]
  onDone: () => void
}) {
  const [email, setEmail] = useState("")
  const [fullName, setFullName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [roleKey, setRoleKey] = useState<IssuableRoleKey>("department_contributor")
  const [departmentId, setDepartmentId] = useState("")
  const [password, setPassword] = useState("")
  const [pending, startTransition] = useTransition()

  const scoped = isDepartmentScoped(roleKey)

  const submit = () => {
    startTransition(async () => {
      const r = await createUser({
        email,
        fullName,
        jobTitle,
        roleKey,
        // Org-wide roles carry no department, whatever was picked earlier.
        departmentId: scoped ? departmentId : "",
        temporaryPassword: password,
      })
      if (r.ok) {
        toast.success(`${fullName} can now sign in.`)
        onDone()
      } else {
        toast.error(r.message)
      }
    })
  }

  return (
    <>
      <div className={formDialogBodyClass}>
        <div className="space-y-2">
          <Label htmlFor="nu-name">Full name <Req /></Label>
          <Input id="nu-name" value={fullName} disabled={pending} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nu-email">Email <Req /></Label>
          <Input id="nu-email" type="email" value={email} disabled={pending} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nu-title">Job title</Label>
          <Input id="nu-title" value={jobTitle} disabled={pending} onChange={(e) => setJobTitle(e.target.value)} />
        </div>

        <div className="space-y-2">
          <Label>Role <Req /></Label>
          <div className="space-y-2">
            {ISSUABLE_ROLES.map((r) => {
              const selected = r.key === roleKey
              return (
                <button
                  type="button"
                  key={r.key}
                  disabled={pending}
                  onClick={() => setRoleKey(r.key)}
                  className={`w-full text-left flex flex-col gap-0.5 p-3 rounded-lg border transition-colors ${
                    selected
                      ? "border-blue-400 bg-blue-50/60 dark:border-blue-700 dark:bg-blue-950/30"
                      : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="text-xs text-muted-foreground">{r.description}</span>
                </button>
              )
            })}
          </div>
        </div>

        {scoped ? (
          <div className="space-y-2">
            <Label htmlFor="nu-department">Department <Req /></Label>
            <Select
              value={departmentId}
              onValueChange={(v) => v && setDepartmentId(v)}
              disabled={pending}
              items={departments.map((d) => ({ value: d.id, label: d.name }))}
            >
              <SelectTrigger id="nu-department" className="w-full">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">This role is organisation-wide and takes no department.</p>
        )}

        <div className="space-y-2">
          <Label htmlFor="nu-password">Temporary password <Req /></Label>
          <Input id="nu-password" type="text" autoComplete="off" value={password} disabled={pending} placeholder="At least 8 characters" onChange={(e) => setPassword(e.target.value)} />
          <p className="text-xs text-muted-foreground">Give it to them directly. They change it after signing in.</p>
        </div>
      </div>

      <DialogFooter className={formDialogFooterClass}>
        <Button variant="outline" onClick={onDone} disabled={pending}>Cancel</Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? "Creating…" : "Create user"}
        </Button>
      </DialogFooter>
    </>
  )
}
