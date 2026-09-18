import { createClient } from "@/lib/supabase/server"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Buildings, GitMerge, SquaresFour, UserCircleGear, UsersThree, UserPlus, Eye } from "@phosphor-icons/react"

export default async function AdminDashboardPage() {
  const supabase = await createClient()

  // Fetch metrics
  const { count: usersCount } = await supabase.from('employees').select('id', { count: 'exact', head: true })
  const { count: deptsCount } = await supabase.from('departments').select('id', { count: 'exact', head: true })
  const { count: pendingCount } = await supabase.from('approval_requests').select('id', { count: 'exact', head: true }).eq('status', 'Pending')

  // Fetch role distribution
  const { data: roleData } = await supabase.from('employees').select('role')
  const roleDistribution = {
    'SYSTEM_ADMIN': 0,
    'DEPARTMENT_MANAGER': 0,
    'CONTRIBUTOR': 0,
    'VIEWER': 0
  }
  
  if (roleData) {
    roleData.forEach(user => {
      if (user.role && roleDistribution[user.role as keyof typeof roleDistribution] !== undefined) {
        roleDistribution[user.role as keyof typeof roleDistribution]++
      }
    })
  }

  const roleConfig = [
    { label: 'System Admins', key: 'SYSTEM_ADMIN', icon: UserCircleGear, color: 'text-rose-500', bg: 'bg-rose-500/10' },
    { label: 'Department Managers', key: 'DEPARTMENT_MANAGER', icon: UsersThree, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Contributors', key: 'CONTRIBUTOR', icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: 'Viewers', key: 'VIEWER', icon: Eye, color: 'text-slate-500', bg: 'bg-slate-500/10' }
  ]

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-2">
          <SquaresFour className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight">System Administration</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total System Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usersCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Departments Configured</CardTitle>
              <Buildings className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{deptsCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Approvals</CardTitle>
              <GitMerge className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Role Distribution</CardTitle>
              <CardDescription>Breakdown of assigned system access levels</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {roleConfig.map((role) => {
                  const count = roleDistribution[role.key as keyof typeof roleDistribution]
                  const percentage = usersCount ? Math.round((count / usersCount) * 100) : 0
                  
                  return (
                    <div key={role.key} className="flex items-center gap-4">
                      <div className={`p-2 rounded-md ${role.bg}`}>
                        <role.icon className={`h-4 w-4 ${role.color}`} weight="fill" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium leading-none">{role.label}</p>
                          <span className="text-sm text-muted-foreground">{count}</span>
                        </div>
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${role.bg.replace('/10', '')} transition-all`} 
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Recent Activity</CardTitle>
              <CardDescription>System audit trail and administrative actions</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Activity logs will be implemented in a future phase.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
