import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { AlertCircle, ListChecks, Target, ShieldAlert } from "lucide-react"
import { PILL, OPEN_WORK_STATUS } from "@/components/shared/status-styles"
import type { OpenAction } from "@/features/action-items/queries"

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  not_started: "Not started",
  planned: "Planned",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
}

const KIND_ICON = {
  action: ListChecks,
  risk_treatment: ShieldAlert,
  objective_activity: Target,
} as const

function formatDue(dueDate: string | null) {
  if (dueDate === null) return "No due date"
  const d = new Date(`${dueDate}T00:00:00Z`)
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" })
}

function isOverdue(a: OpenAction) {
  if (!a.dueDate) return false
  if (a.status === "completed" || a.status === "cancelled") return false
  return a.dueDate < new Date().toISOString().slice(0, 10)
}

/**
 * Open work across all three sources v_open_action_items unions: manually
 * created actions, risk treatments, and objective activities. Read-only —
 * only a kind='action' row could be edited through the actions mutations,
 * a risk_treatment or objective_activity is not an action, so this card
 * carries no edit control for any row rather than one that only sometimes
 * works.
 */
export function OpenActionsCard({ actions }: { actions: OpenAction[] }) {
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
              const Icon = KIND_ICON[a.kind]
              return (
                <div
                  key={`${a.kind}-${a.id}`}
                  className="flex items-start gap-3 border-b border-border/50 pb-4 last:border-0 last:pb-0"
                >
                  <div
                    className={`mt-0.5 rounded-full p-2 shrink-0 ${
                      overdue
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                        : "bg-slate-100 text-slate-600 dark:bg-slate-900 dark:text-slate-400"
                    }`}
                  >
                    {overdue ? <AlertCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
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
                  <span className={`${PILL} ${OPEN_WORK_STATUS[a.status] ?? ""} shrink-0`}>
                    {STATUS_LABEL[a.status] ?? a.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
