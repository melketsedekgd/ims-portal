import { Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getCurrentUser } from "@/features/auth/queries";
import { isAdmin } from "@/lib/permissions";
import { getAdminDepartments } from "@/features/admin/queries";
import { DepartmentSheet } from "@/features/admin/components/DepartmentSheet";

/**
 * Departments with how many people hold a role in each. An IMS admin
 * creates and edits (retiring is a status, never a delete); a department
 * manager sees their own, read-only.
 */
export default async function DepartmentsPage() {
  const [user, departments] = await Promise.all([getCurrentUser(), getAdminDepartments()]);
  const admin = isAdmin(user);

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            <h1 className="text-2xl font-bold tracking-tight">Departments</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {admin
              ? "The units that objectives, KPIs and risks are filed under."
              : "The department you manage."}
          </p>
        </div>
        {admin && <DepartmentSheet />}
      </div>

      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Department</TableHead>
              <TableHead className="h-10">Code</TableHead>
              <TableHead className="h-10">People</TableHead>
              <TableHead className="h-10">Status</TableHead>
              {admin && <TableHead className="h-10 w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={admin ? 5 : 4} className="h-32 text-center text-sm text-muted-foreground">
                  No departments to show.
                </TableCell>
              </TableRow>
            ) : (
              departments.map((d) => (
                <TableRow key={d.id} className={d.status === "inactive" ? "opacity-60" : undefined}>
                  <TableCell className="pl-6 font-medium">
                    {d.name}
                    {d.description && (
                      <p className="text-xs text-muted-foreground font-normal truncate max-w-[360px]">{d.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs text-slate-500">{d.code}</Badge>
                  </TableCell>
                  <TableCell className="text-sm">{d.userCount}</TableCell>
                  <TableCell>
                    {d.status === "active" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Active</Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">Inactive</Badge>
                    )}
                  </TableCell>
                  {admin && (
                    <TableCell>
                      <DepartmentSheet department={d} />
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
