"use client"

import { Settings, Users, Building2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function AdminDashboardPage() {
  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-slate-800 dark:text-slate-200" />
          <h1 className="text-2xl font-bold tracking-tight">System Administration</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Manage system-wide configuration, users, roles, and departmental structure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Quick Links / Status Cards */}
        <Card className="hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer border-slate-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-500" />
              Departments
            </CardTitle>
            <CardDescription>Manage organization structure</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">12</p>
            <p className="text-xs text-muted-foreground mt-1">Active Departments</p>
          </CardContent>
        </Card>

        <Card className="hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition-colors cursor-pointer border-slate-200 dark:border-zinc-800 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-indigo-600 dark:text-indigo-500" />
              Users & Roles
            </CardTitle>
            <CardDescription>Manage access and permissions</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">148</p>
            <p className="text-xs text-muted-foreground mt-1">Registered Users</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
