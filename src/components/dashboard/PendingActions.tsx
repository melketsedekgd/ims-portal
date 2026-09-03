"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Clock } from "lucide-react"

const actions = [
  { id: 1, title: "Submit Q3 Risk Review", due: "In 2 days", priority: "high", icon: AlertCircle },
  { id: 2, title: "Upload InfoSec Evidence", due: "In 5 days", priority: "medium", icon: Clock },
  { id: 3, title: "Approve KPI Target Changes", due: "Next week", priority: "low", icon: CheckCircle2 },
]

export function PendingActions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending Actions</CardTitle>
        <CardDescription>Tasks requiring your attention</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-5">
          {actions.map((action) => (
            <div key={action.id} className="flex items-start gap-4 border-b border-border/50 pb-4 last:border-0 last:pb-0">
              <div className={`mt-0.5 rounded-full p-2 ${action.priority === 'high' ? 'bg-rose-100 text-rose-600 dark:bg-rose-950/50' : action.priority === 'medium' ? 'bg-amber-100 text-amber-600 dark:bg-amber-950/50' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50'}`}>
                <action.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-semibold leading-none">{action.title}</p>
                <p className="text-xs font-medium text-muted-foreground">Due: {action.due}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
