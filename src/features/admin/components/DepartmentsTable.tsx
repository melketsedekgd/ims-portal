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
import { LIST_CARD, LIST_HEAD, LIST_HEAD_ROW, LIST_ROW_LOCKED, listRow } from "@/components/shared/list-styles"
import { ACTIVE_STATUS, ACTIVE_STATUS_LABEL, PILL } from "@/components/shared/status-styles"
import { ADMIN_DEPARTMENT_COLUMNS, type AdminDepartmentColumnKey } from "@/features/admin/columns"
import { DepartmentSheet } from "@/features/admin/components/DepartmentSheet"
import type { AdminDepartmentItem } from "@/features/admin/queries"
import { useColumnChoice } from "@/features/table-preferences/components/ColumnChoiceProvider"

const CELLS: Record<
  AdminDepartmentColumnKey,
  { head?: string; cell?: string; render: (d: AdminDepartmentItem) => React.ReactNode }
> = {
  department: {
    head: "pl-4",
    cell: "pl-4 font-medium",
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
    render: (d) => (
      <span className={`${PILL} ${ACTIVE_STATUS[d.status]}`}>{ACTIVE_STATUS_LABEL[d.status]}</span>
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
    <div ref={cardRef} className={LIST_CARD}>
      <ColumnsBar
        registry={ADMIN_DEPARTMENT_COLUMNS}
        keys={columns}
        listed={() => true}
        onChange={setColumns}
        onReset={resetColumns}
      />
      <Table>
        <TableHeader>
          <TableRow className={LIST_HEAD_ROW}>
            {visible.map((c) => (
              <TableHead key={c.key} className={`${LIST_HEAD} ${CELLS[c.key].head ?? ""}`}>
                {c.label}
              </TableHead>
            ))}
            <TableHead className={`${LIST_HEAD} w-[50px]`} />
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
              <TableRow key={d.id} className={`${listRow(false, false)} ${d.status === "inactive" ? LIST_ROW_LOCKED : ""}`}>
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
