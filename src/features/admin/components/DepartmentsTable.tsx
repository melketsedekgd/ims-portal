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
import { ADMIN_DEPARTMENT_COLUMNS, type AdminDepartmentColumnKey } from "@/features/admin/columns"
import { DepartmentSheet } from "@/features/admin/components/DepartmentSheet"
import type { AdminDepartmentItem } from "@/features/admin/queries"
import { useColumnChoice } from "@/features/table-preferences/components/ColumnChoiceProvider"

const CELLS: Record<
  AdminDepartmentColumnKey,
  { head?: string; cell?: string; render: (d: AdminDepartmentItem) => React.ReactNode }
> = {
  department: {
    head: "pl-6",
    cell: "pl-6 font-medium",
    render: (d) => (
      <>
        {d.name}
        {d.description && (
          <p className="text-xs text-muted-foreground font-normal truncate max-w-[360px]">{d.description}</p>
        )}
      </>
    ),
  },
  code: {
    render: (d) => (
      <Badge variant="outline" className="font-mono text-xs text-slate-500">{d.code}</Badge>
    ),
  },
  people: { cell: "text-sm", render: (d) => d.userCount },
  status: {
    render: (d) =>
      d.status === "active" ? (
        <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Active</Badge>
      ) : (
        <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400">Inactive</Badge>
      ),
  },
}

/** Departments, with the lists' columns strip and pager. No filters: the page has none. */
export function DepartmentsTable({ departments }: { departments: AdminDepartmentItem[] }) {
  const { keys: columns, set: setColumns, reset: resetColumns } = useColumnChoice(ADMIN_DEPARTMENT_COLUMNS)
  const visible = ADMIN_DEPARTMENT_COLUMNS.columns.filter((c) => columns.includes(c.key))
  // +1 for the edit column.
  const colCount = visible.length + 1

  // Nothing narrows the list, so nothing sends it back to page 1.
  const pager = usePagination(departments.length, "")
  const cardRef = useRef<HTMLDivElement>(null)

  return (
    <div ref={cardRef} className="rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
      <ColumnsBar
        registry={ADMIN_DEPARTMENT_COLUMNS}
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
          {departments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={colCount} className="h-32 text-center text-sm text-muted-foreground">
                No departments to show.
              </TableCell>
            </TableRow>
          ) : (
            departments.slice(pager.start, pager.end).map((d) => (
              <TableRow key={d.id} className={d.status === "inactive" ? "opacity-60" : undefined}>
                {visible.map((c) => (
                  <TableCell key={c.key} className={CELLS[c.key].cell}>
                    {CELLS[c.key].render(d)}
                  </TableCell>
                ))}
                <TableCell>
                  <DepartmentSheet department={d} />
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
