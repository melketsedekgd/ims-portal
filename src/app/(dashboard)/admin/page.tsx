import Link from "next/link";
import { Building2, PlusCircle, Settings, Shield, UserPlus, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminOverview } from "@/features/admin/queries";
import { RoleBadge } from "@/features/admin/components/RoleBadge";

/**
 * Counts from the tables that exist. No audit feed: audit_logs does not
 * exist, and an invented one on an administration screen is a false
 * record. It comes back with Epic 10.
 */
export default async function AdminOverviewPage() {
  const overview = await getAdminOverview();

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1440px] mx-auto">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Settings className="h-6 w-6 text-slate-800 dark:text-slate-200" />
          <h1 className="text-2xl font-bold tracking-tight">Administration</h1>
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Departments, people and the roles they hold.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active departments</CardTitle>
            <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overview.activeDepartments}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active users</CardTitle>
            <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overview.activeUsers}</p>
          </CardContent>
        </Card>
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Roles in use</CardTitle>
            <Shield className="h-4 w-4 text-rose-600 dark:text-rose-500" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{overview.rolesInUse.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Role assignments</CardTitle>
            <CardDescription>Every role held by someone, and by how many.</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.rolesInUse.length === 0 ? (
              <p className="text-sm text-muted-foreground">No roles are assigned.</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {overview.rolesInUse.map((r) => (
                  <li key={r.key} className="flex items-center justify-between py-2.5">
                    <RoleBadge roleKey={r.key} name={r.name} />
                    <span className="text-sm font-semibold tabular-nums">{r.count}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 shadow-sm h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link
              href="/admin/users"
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm")}
            >
              <UserPlus className="h-4 w-4 mr-2 text-indigo-500" />
              Add a user
            </Link>
            <Link
              href="/admin/departments"
              className={cn(buttonVariants({ variant: "outline" }), "w-full justify-start bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-sm")}
            >
              <PlusCircle className="h-4 w-4 mr-2 text-blue-500" />
              Add a department
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
