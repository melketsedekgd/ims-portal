import { Users } from "lucide-react";
import { getCurrentUser } from "@/features/auth/queries";
import { getAdminUsers, getActiveDepartments } from "@/features/admin/queries";
import { ADMIN_USER_COLUMNS } from "@/features/admin/columns";
import { CreateUserSheet } from "@/features/admin/components/CreateUserSheet";
import { UsersTable } from "@/features/admin/components/UsersTable";
import { ColumnChoiceProvider } from "@/features/table-preferences/components/ColumnChoiceProvider";
import { getSavedColumns } from "@/features/table-preferences/queries";

/**
 * Users and their roles. Everyone reaching this page is an IMS admin —
 * admin/layout.tsx has already turned everyone else away — so there is
 * no read-only branch. The current user is fetched only to keep the
 * remove button off their own row.
 */
export default async function UsersPage() {
  const [user, users, departments, savedColumns] = await Promise.all([
    getCurrentUser(),
    getAdminUsers(),
    getActiveDepartments(),
    getSavedColumns("admin_users"),
  ]);
  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1440px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
            <h1 className="text-2xl font-bold tracking-tight">Users &amp; Roles</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Everyone with an account, and what each of them holds.
          </p>
        </div>
        <CreateUserSheet departments={departments} />
      </div>

      <ColumnChoiceProvider registry={ADMIN_USER_COLUMNS} saved={savedColumns} multiDepartment>
        <UsersTable users={users} currentUserId={user?.id ?? null} />
      </ColumnChoiceProvider>
    </div>
  );
}
