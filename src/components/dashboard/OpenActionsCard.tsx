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
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="font-semibold text-ink">Actions</CardTitle>
          <CardDescription>Work assigned against risks, KPIs, objectives and other findings</CardDescription>
        </div>
        <Link
          href="/department/actions"
          className="text-xs font-medium text-muted-foreground hover:text-ink hover:underline shrink-0"
        >
          View all
        </Link>
      </CardHeader>
      <CardContent>
        {actions.length === 0 ? (
          <div className="py-10 flex flex-col items-center justify-center text-center gap-2">
            <ListChecks className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">No open actions</p>
            <p className="text-xs text-muted-foreground max-w-sm">
              No actions have been created yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ink/5">
            {actions.map((a) => {
              const overdue = isOverdue(a)
              const Icon = KIND_ICON[a.kind]
              return (
                <div
                  key={`${a.kind}-${a.id}`}
                  className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
                >
                  {/* Overdue keeps its rose square: it is the one row state
                      the list flags on its own, before anyone reads a date. */}
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${
                      overdue
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                        : "bg-coral-tint text-coral-600"
                    }`}
                  >
                    {overdue ? <AlertCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug text-ink line-clamp-2" title={a.title}>
                      {a.title}
                    </p>
                    {a.ownerTitle && (
                      <p className="mt-0.5 text-xs text-muted-foreground truncate">{a.ownerTitle}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1 text-right">
                    <span
                      className={`text-xs tabular-nums ${
                        overdue ? "text-rose-600 dark:text-rose-400 font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {formatDue(a.dueDate)}
                    </span>
                    <span className={`${PILL} ${OPEN_WORK_STATUS[a.status] ?? ""}`}>
                      {STATUS_LABEL[a.status] ?? a.status}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
