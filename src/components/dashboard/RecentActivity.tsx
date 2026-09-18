"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Target, ShieldWarning, ChartBar, ArrowRight } from "@phosphor-icons/react"
import Link from "next/link"

interface Props {
  departmentId?: string
  refreshKey?: number
}

const activities = [
  { id: 1, type: "objective", action: "Updated progress on 'Q3 Revenue Goal' to 85%", actor: "Nahom", time: "2 hours ago", icon: Target },
  { id: 2, type: "risk", action: "Identified new High-Severity risk 'Vendor Data Breach'", actor: "Admin", time: "4 hours ago", icon: ShieldWarning },
  { id: 3, type: "kpi", action: "Recorded monthly measurement for 'Server Uptime'", actor: "Nahom", time: "Yesterday", icon: ChartBar },
  { id: 4, type: "objective", action: "Completed objective 'ISO 27001 Audit Prep'", actor: "Sarah", time: "2 days ago", icon: Target },
]

export function RecentActivity({ departmentId, refreshKey }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          <CardDescription>Latest updates across the department</CardDescription>
        </div>
        <div>
          <Link href="/department/progress" className="text-xs font-medium text-primary hover:underline flex items-center gap-1 w-max">
            View full audit log <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col">
        <div className="space-y-6">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4">
              <div className="mt-0.5 rounded-md p-2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-muted-foreground">
                <activity.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 space-y-1.5">
                <p className="text-sm font-medium leading-tight">{activity.action}</p>
                <div className="flex items-center text-xs text-muted-foreground gap-2">
                  <span className="font-semibold text-foreground/70">{activity.actor}</span>
                  <span>•</span>
                  <span>{activity.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
