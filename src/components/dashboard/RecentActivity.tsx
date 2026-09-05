"use client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Target, ShieldAlert, BarChart3, ArrowRight } from "lucide-react"
import Link from "next/link"

const activities = [
  { id: 1, type: "objective", action: "Updated progress on 'Q3 Revenue Goal' to 85%", actor: "Nahom", time: "2 hours ago", icon: Target },
  { id: 2, type: "risk", action: "Identified new High-Severity risk 'Vendor Data Breach'", actor: "Admin", time: "4 hours ago", icon: ShieldAlert },
  { id: 3, type: "kpi", action: "Recorded monthly measurement for 'Server Uptime'", actor: "Nahom", time: "Yesterday", icon: BarChart3 },
  { id: 4, type: "objective", action: "Completed objective 'ISO 27001 Audit Prep'", actor: "Sarah", time: "2 days ago", icon: Target },
]

export function RecentActivity() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest updates across the department</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col">
        <div className="space-y-6">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-4">
              <div className="mt-0.5 rounded-md p-2 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
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
        <div className="mt-6 pt-4 border-t">
          <Link href="/department/reports" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 w-max">
            View full audit log <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
