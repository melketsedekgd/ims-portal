"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { UserX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { removeUser } from "@/features/admin/mutations"

/** IMS admin only. Removes access; the profile stays, attributed to its history. */
export function RemoveUserButton({ userId, fullName }: { userId: string; fullName: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, startTransition] = useTransition()

  const confirm = () =>
    startTransition(async () => {
      const r = await removeUser(userId)
      if (r.ok) {
        toast.success(`${fullName} no longer has access.`)
        setConfirming(false)
      } else {
        toast.error(r.message)
      }
    })

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
        title="Remove access"
        aria-label={`Remove ${fullName}`}
        onClick={() => setConfirming(true)}
      >
        <UserX className="h-4 w-4" />
      </Button>
      {confirming && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Remove {fullName}?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Their roles are removed and their sign-in is blocked. Everything they recorded stays in their name.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setConfirming(false)} disabled={pending}>Cancel</Button>
              <Button variant="destructive" onClick={confirm} disabled={pending}>
                {pending ? "Removing…" : "Remove access"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
