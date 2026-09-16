import { Users } from "lucide-react";
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
import { getAdminUsers, getActiveDepartments } from "@/features/admin/queries";
import { RoleBadge } from "@/features/admin/components/RoleBadge";
import { CreateUserSheet } from "@/features/admin/components/CreateUserSheet";
import { RemoveUserButton } from "@/features/admin/components/RemoveUserButton";

/**
 * Users and their roles. An IMS admin sees everyone and can create or
 * remove; a department manager sees the people in their department,
 * read-only. The layout has already turned everyone else away.
 */
export default async function UsersPage() {
  const [user, users, departments] = await Promise.all([
    getCurrentUser(),
    getAdminUsers(),
    getActiveDepartments(),
  ]);
  const admin = isAdmin(user);

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
            <h1 className="text-2xl font-bold tracking-tight">Users &amp; Roles</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {admin
              ? "Everyone with an account, and what each of them holds."
              : "People holding a role in the department you manage."}
          </p>
        </div>
        {admin && <CreateUserSheet departments={departments} />}
      </div>

      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">User</TableHead>
              <TableHead className="h-10">Roles</TableHead>
              <TableHead className="h-10">Status</TableHead>
              {admin && <TableHead className="h-10 w-[50px]" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={admin ? 4 : 3} className="h-32 text-center text-sm text-muted-foreground">
                  No users to show.
                </TableCell>
              </TableRow>
            ) : (
              users.map((u) => (
                <TableRow key={u.id} className={u.status === "inactive" ? "opacity-60" : undefined}>
                  <TableCell className="pl-6 font-medium">
                    {u.fullName}
                    {u.jobTitle && <p className="text-xs text-muted-foreground font-normal">{u.jobTitle}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1.5">
                      {u.roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">No roles</span>
                      ) : (
                        u.roles.map((r, i) => (
                          <RoleBadge key={`${r.key}-${r.department?.id ?? "org"}-${i}`} roleKey={r.key} name={r.name} departmentCode={r.department?.code} />
                        ))
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {u.status === "active" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Active</Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">Inactive</Badge>
                    )}
                  </TableCell>
                  {admin && (
                    <TableCell>
                      {u.status === "active" && u.id !== user?.id && (
                        <RemoveUserButton userId={u.id} fullName={u.fullName} />
                      )}
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
