import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { History } from "lucide-react"

/**
 * No audit table exists. The four entries this card used to show were written
 * into the component — names, actions and relative timestamps — on a page whose
 * whole purpose is oversight. An empty state is the honest version until
 * something actually records activity.
 */
export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates across the department</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border border-dashed p-8 flex flex-col items-center justify-center text-center gap-2">
          <History className="h-7 w-7 text-muted-foreground/40" />
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
            No activity log yet
          </p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Nothing records who changed what and when, so there is no history to
            show here. This fills in once edits are tracked.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
