import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Target, ShieldAlert } from "lucide-react"
import type { ActionItem } from "@/features/action-items/queries"

function formatDue(dueDate: string | null) {
  if (dueDate === null) return "No target date"
  // Dates come back as YYYY-MM-DD. Parsed as UTC so the label cannot shift a
  // day depending on where the browser is.
  const d = new Date(`${dueDate}T00:00:00Z`)
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  })
}

function isOverdue(dueDate: string | null) {
  if (dueDate === null) return false
  return dueDate < new Date().toISOString().slice(0, 10)
}

/**
 * Real open work: objective activities that are not started or in progress,
 * and risk treatments that are planned or in progress, soonest first.
 *
 * Not period-scoped. Both tables hold standing work with its own dates, so this
 * list does not change when the period picker moves — outstanding work does not
 * become un-outstanding because you looked at last quarter.
 */
export function PendingActions({ items }: { items: ActionItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Actions</CardTitle>
        <CardDescription>
          Objective activities and risk treatments still outstanding
        </CardDescription>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed p-8 flex flex-col items-center justify-center text-center gap-2">
            <CheckCircle2 className="h-7 w-7 text-muted-foreground/40" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Nothing outstanding
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Every objective activity and risk treatment is completed or cancelled.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {items.map((item) => {
              const overdue = isOverdue(item.dueDate)
              const Icon = item.kind === "activity" ? Target : ShieldAlert
              return (
                <Link
                  key={`${item.kind}-${item.id}`}
                  href={item.href}
                  className="flex items-start gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0 group"
                >
                  <div
                    className={`mt-0.5 rounded-full p-2 shrink-0 ${
                      overdue
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                        : item.kind === "activity"
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                          : "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                    }`}
                  >
                    {overdue ? <AlertCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 space-y-1 min-w-0">
                    <p className="text-sm font-semibold leading-snug line-clamp-2 group-hover:underline" title={item.title}>
                      {item.title}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-1" title={item.parentTitle}>
                      {item.parentTitle}
                    </p>
                    <p className="text-xs font-medium text-muted-foreground">
                      <span className={overdue ? "text-rose-600 dark:text-rose-400" : ""}>
                        {formatDue(item.dueDate)}
                      </span>
                      <span className="mx-1.5 text-muted-foreground/50">·</span>
                      {item.statusLabel}
                      {item.ownerTitle && (
                        <>
                          <span className="mx-1.5 text-muted-foreground/50">·</span>
                          {item.ownerTitle}
                        </>
                      )}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
