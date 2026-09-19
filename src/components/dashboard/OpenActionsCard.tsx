import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertCircle, ListChecks } from "lucide-react"
import { PILL, ACTION_STATUS } from "@/components/shared/status-styles"
import type { Action } from "@/features/action-items/queries"
import type { Enums } from "@/types/database"

const STATUS_LABEL: Record<Enums<"action_status">, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
}

function formatDue(dueDate: string | null) {
  if (dueDate === null) return "No due date"
  const d = new Date(`${dueDate}T00:00:00Z`)
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" })
}

function isOverdue(a: Action) {
  if (!a.dueDate) return false
  if (a.status === "completed" || a.status === "cancelled") return false
  return a.dueDate < new Date().toISOString().slice(0, 10)
}

/**
 * Manually created actions (Epic 6) — a different table from PendingActions'
 * objective-activity/risk-treatment feed above it, and can genuinely be
 * empty: nothing opens a row here automatically.
 */
export function OpenActionsCard({ actions }: { actions: Action[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle>Actions</CardTitle>
          <CardDescription>Work assigned against risks, KPIs, objectives and other findings</CardDescription>
        </div>
        <Link href="/department/actions" className="text-xs font-medium text-ink hover:underline shrink-0">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 flex flex-col items-center justify-center text-center gap-2">
            <ListChecks className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">No open actions</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              No actions have been created yet.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {actions.map((a) => {
              const overdue = isOverdue(a)
              return (
                <div key={a.id} className="flex items-start gap-3 border-b border-border/50 pb-4 last:border-0 last:pb-0">
                  <div
                    className={`mt-0.5 rounded-full p-2 shrink-0 ${
                      overdue
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {overdue ? <AlertCircle className="h-4 w-4" /> : <ListChecks className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-sm font-semibold leading-snug line-clamp-2" title={a.title}>
                      {a.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className={overdue ? "text-rose-600 dark:text-rose-400 font-medium" : ""}>
                        {formatDue(a.dueDate)}
                      </span>
                      {a.ownerTitle && (
                        <>
                          <span className="mx-1.5 text-muted-foreground/50">·</span>
                          {a.ownerTitle}
                        </>
                      )}
                    </p>
                  </div>
                  <span className={`${PILL} ${ACTION_STATUS[a.status]} shrink-0`}>{STATUS_LABEL[a.status]}</span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
