"use client"
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { ClockCounterClockwise } from "@phosphor-icons/react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { TableSkeleton } from "@/components/shared/TableSkeleton"

export default function ActivityPage() {
  const supabase = createClient()
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchActivities() {
      const { data } = await supabase
        .from('approval_actions')
        .select('*, approval_requests(entity_type, department_id), employees!actor_id(firstname, lastname)')
        .order('created_at', { ascending: false })
        .limit(50)
      
      if (data) setActivities(data)
      setLoading(false)
    }
    fetchActivities()
  }, [supabase])

  return (
    <div className="flex-1 p-4 md:p-6 max-w-[1200px] mx-auto w-full space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <ClockCounterClockwise className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold tracking-tight">System Activity</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Workflow Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <TableSkeleton columns={4} rows={5} />
          ) : activities.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              No recent activity found.
            </div>
          ) : (
            <div className="space-y-4">
              {activities.map(act => (
                <div key={act.id} className="flex items-center justify-between p-3 border-b last:border-0 hover:bg-muted/50 rounded transition-colors">
                  <div>
                    <p className="font-medium">
                      {act.employees?.firstname} {act.employees?.lastname}
                      <span className="font-normal text-muted-foreground ml-2">
                        {act.action === 'APPROVED' ? 'approved' : act.action === 'REJECTED' ? 'rejected' : act.action} a {act.approval_requests?.entity_type}
                      </span>
                    </p>
                    {act.comments && <p className="text-sm text-muted-foreground mt-1">&quot;{act.comments}&quot;</p>}
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(act.created_at).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
