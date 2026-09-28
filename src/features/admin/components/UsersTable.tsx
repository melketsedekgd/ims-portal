"use client"

import { useRef } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import ColumnsBar from "@/components/shared/ColumnsBar"
import ListPagination, { usePagination } from "@/components/shared/ListPagination"
import { ADMIN_USER_COLUMNS, type AdminUserColumnKey } from "@/features/admin/columns"
import { RoleBadge } from "@/features/admin/components/RoleBadge"
import { RemoveUserButton } from "@/features/admin/components/RemoveUserButton"
import type { AdminUserItem } from "@/features/admin/queries"
import { useColumnChoice } from "@/features/table-preferences/components/ColumnChoiceProvider"

const CELLS: Record<AdminUserColumnKey, { head?: string; cell?: string; render: (u: AdminUserItem) => React.ReactNode }> = {
  user: {
    head: "pl-6",
    cell: "pl-6 font-medium",
    render: (u) => (
      <>
        {u.fullName}
        {u.jobTitle && <p className="text-xs text-muted-foreground font-normal">{u.jobTitle}</p>}
      </>
    ),
  },
  roles: {
    render: (u) => (
      <div className="flex flex-wrap gap-1.5">
        {u.roles.length === 0 ? (
          <span className="text-xs text-muted-foreground">No roles</span>
        ) : (
          u.roles.map((r, i) => (
            <RoleBadge key={`${r.key}-${r.department?.id ?? "org"}-${i}`} roleKey={r.key} name={r.name} departmentCode={r.department?.code} />
          ))
        )}
      </div>
    ),
  },
  status: {
    render: (u) =>
      u.status === "active" ? (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Active</Badge>
      ) : (
        <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">Inactive</Badge>
      ),
  },
}

/**
 * Users and their roles, with the lists' columns strip and pager. No
 * filters: the page has none. `currentUserId` keeps the remove button off
 * the signed-in admin's own row.
 */
export function UsersTable({ users, currentUserId }: { users: AdminUserItem[]; currentUserId: string | null }) {
  const { keys: columns, set: setColumns, reset: resetColumns } = useColumnChoice(ADMIN_USER_COLUMNS)
  const visible = ADMIN_USER_COLUMNS.columns.filter((c) => columns.includes(c.key))
  // +1 for the remove column.
  const colCount = visible.length + 1

  // Nothing narrows the list, so nothing sends it back to page 1.
  const pager = usePagination(users.length, "")
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={cardRef} className="rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
      <ColumnsBar
        registry={ADMIN_USER_COLUMNS}
        keys={columns}
        listed={() => true}
        onChange={setColumns}
        onReset={resetColumns}
      />
      <Table>
        <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
          <TableRow>
            {visible.map((c) => (
              <TableHead key={c.key} className={`h-10 ${CELLS[c.key].head ?? ""}`}>
                {c.label}
              </TableHead>
            ))}
            <TableHead className="h-10 w-[50px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="h-32 text-center text-sm text-muted-foreground">
                No users to show.
              </TableCell>
            </TableRow>
          ) : (
            users.slice(pager.start, pager.end).map((u) => (
              <TableRow key={u.id} className={u.status === "inactive" ? "opacity-60" : undefined}>
                {visible.map((c) => (
                  <TableCell key={c.key} className={CELLS[c.key].cell}>
                    {CELLS[c.key].render(u)}
                  </TableCell>
                ))}
                <TableCell>
                  {u.status === "active" && u.id !== currentUserId && (
                    <RemoveUserButton userId={u.id} fullName={u.fullName} />
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <ListPagination pager={pager} scrollTarget={cardRef} />
    </div>
  )
}
