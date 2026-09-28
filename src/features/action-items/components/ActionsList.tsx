"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { AlertCircle, ListChecks } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import PageHeader from "@/components/shared/PageHeader"
import { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
import FilterMenu, { type FilterCategory } from "@/components/shared/FilterMenu"
import ColumnsBar from "@/components/shared/ColumnsBar"
import ListPagination, { usePagination } from "@/components/shared/ListPagination"
import { PILL, ACTION_STATUS } from "@/components/shared/status-styles"
import { LIST_CARD, LIST_HEAD, LIST_HEAD_ROW, listRow } from "@/components/shared/list-styles"
import NewActionButton from "@/features/action-items/components/NewActionButton"
import UpdateActionStatusButton from "@/features/action-items/components/UpdateActionStatusButton"
import type { Action } from "@/features/action-items/queries"
import type { ActionSourceInfo } from "@/features/action-items/sources"
import { ACTION_COLUMNS, type ActionColumnKey } from "@/features/action-items/columns"
import { useColumnChoice } from "@/features/table-preferences/components/ColumnChoiceProvider"
import type { Enums } from "@/types/database"

const STATUS_FILTER: { value: Enums<"action_status">; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "blocked", label: "Blocked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
]

const PRIORITY_FILTER: { value: string; label: string }[] = [
  { value: "3", label: "High" },
  { value: "2", label: "Medium" },
  { value: "1", label: "Low" },
]

const STATUS_LABEL: Record<Enums<"action_status">, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
}

const SOURCE_LABEL: Record<Enums<"action_source">, string> = {
  risk: "Risk",
  risk_treatment: "Risk treatment",
  risk_treatment_review: "Treatment review",
  kpi: "KPI",
  kpi_measurement: "KPI measurement",
  objective: "Objective",
  objective_measurement: "Objective measurement",
  document_change: "Document change",
  action: "Action",
  other: "Other",
}

// Dates come back as YYYY-MM-DD; parsed as UTC so the label cannot shift a
// day depending on where the browser is.
function fmtDate(iso: string | null) {
  if (!iso) return "—"
  const d = new Date(`${iso}T00:00:00Z`)
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" })
}

/**
 * The dashboard link carries the dashboard's selection back with it, but
 * only one of ?view and ?dept — the dashboard reads exactly one. When a
 * hand-typed URL holds both, view wins, the same tie-break as
 * resolveDashboardView.
 */
function dashboardHref(params: URLSearchParams) {
  for (const key of ["view", "dept"]) {
    const value = params.get(key)
    if (value) return `/department?${new URLSearchParams({ [key]: value })}`
  }
  return "/department"
}

function isOverdue(a: Action) {
  if (!a.dueDate) return false
  if (a.status === "completed" || a.status === "cancelled") return false
  return a.dueDate < new Date().toISOString().slice(0, 10)
}

const HEAD = LIST_HEAD
const TEXT = "text-muted-foreground text-sm"

/**
 * How each registry column renders. A Record, so a column added to
 * ACTION_COLUMNS without a renderer here fails the typecheck. Labels come
 * from the registry; only layout lives here.
 */
const CELLS: Record<
  ActionColumnKey,
  { head?: string; cell?: string; title?: (row: Action) => string | undefined; render: (row: Action) => React.ReactNode }
> = {
  title: {
    head: "pl-4",
    cell: "font-medium max-w-[260px] pl-4",
    render: (row) => (
      <div className="truncate" title={row.title}>
        {row.title}
      </div>
    ),
  },
  department: { cell: TEXT, render: (row) => row.departmentName ?? "—" },
  source: { cell: TEXT, render: (row) => SOURCE_LABEL[row.sourceType] },
  owner: {
    cell: `${TEXT} max-w-[150px] truncate`,
    title: (row) => row.ownerTitle ?? undefined,
    render: (row) => row.ownerTitle || "—",
  },
  priority: {
    cell: "text-sm",
    render: (row) =>
      row.priority
        ? PRIORITY_FILTER.find((p) => p.value === String(row.priority))?.label ?? row.priority
        : "—",
  },
  start: { cell: "text-sm whitespace-nowrap", render: (row) => fmtDate(row.startDate) },
  due: {
    cell: "text-sm whitespace-nowrap",
    render: (row) => {
      const overdue = isOverdue(row)
      return (
        <span
          className={
            overdue ? "text-rose-600 dark:text-rose-400 font-medium inline-flex items-center gap-1" : ""
          }
        >
          {overdue && <AlertCircle className="h-3.5 w-3.5" />}
          {fmtDate(row.dueDate)}
        </span>
      )
    },
  },
  progress: {
    cell: "text-sm tabular-nums",
    render: (row) => (row.completionPercentage === null ? "—" : `${row.completionPercentage}%`),
  },
  status: {
    render: (row) => (
      <span className={`${PILL} ${ACTION_STATUS[row.status]}`}>{STATUS_LABEL[row.status]}</span>
    ),
  },
}

export default function ActionsList({
  initialData,
  departments,
  canManageDepartmentIds,
}: {
  initialData: Action[]
  /** What each action belongs to, keyed by action id (v_action_sources). */
  sources: Record<string, ActionSourceInfo>
  /** Creatable departments, for the standalone "New action" entrance. */
  departments: { id: string; name: string; code: string }[]
  /** Department ids the current user can edit actions in, or "all" for an IMS admin. */
  canManageDepartmentIds: string[] | "all"
}) {
  const data = initialData
  const searchParams = useSearchParams()

  // Status/priority filters — component state, not the URL. Actions are not
  // period-scoped, so there is no picker deciding what was fetched here.
  const [statusFilter, setStatusFilter] = useState<Enums<"action_status">[]>([])
  const [priorityFilter, setPriorityFilter] = useState<string[]>([])

  const statusCounts = countBy(data, STATUS_FILTER, (row) => row.status)
  const priorityCounts = countBy(
    data.filter((r) => r.priority !== null),
    PRIORITY_FILTER,
    (row) => String(row.priority)
  )

  const matches = (row: Action) =>
    (statusFilter.length === 0 || statusFilter.includes(row.status)) &&
    (priorityFilter.length === 0 ||
      (row.priority !== null && priorityFilter.includes(String(row.priority))))

  const filtered = data.filter(matches)
  const visibleCount = filtered.length
  const clearFilters = () => {
    setStatusFilter([])
    setPriorityFilter([])
  }

  const filterCategories: FilterCategory[] = [
    {
      id: "status",
      label: "Status",
      options: statusCounts,
      selected: statusFilter,
      onChange: (next) => setStatusFilter(next as Enums<"action_status">[]),
    },
    {
      id: "priority",
      label: "Priority",
      options: priorityCounts,
      selected: priorityFilter,
      onChange: setPriorityFilter,
    },
  ]

  const { keys: columns, set: setColumns, reset: resetColumns } = useColumnChoice(ACTION_COLUMNS)
  const visible = ACTION_COLUMNS.columns.filter((c) => columns.includes(c.key))
  // +1 for the status-update column.
  const colCount = visible.length + 1

  // Paged after the filters; back to page 1 when a filter changes. Not
  // period-scoped, so nothing in the URL changes which rows match.
  const pager = usePagination(visibleCount, JSON.stringify([statusFilter, priorityFilter]))
  // The card, so a page change can bring its top back into view.
  const cardRef = useRef<HTMLDivElement>(null)

  const canManage = (departmentId: string) =>
    canManageDepartmentIds === "all" || canManageDepartmentIds.includes(departmentId)

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <div className="space-y-2">
        <Link
          href={dashboardHref(searchParams)}
          className="text-xs font-medium text-muted-foreground hover:text-ink hover:underline"
        >
          ← Dashboard
        </Link>
        <PageHeader
          title="Actions"
          description="Work assigned against risks, KPIs, objectives and other findings."
          actions={<NewActionButton departments={departments} />}
        />
      </div>

      <div ref={cardRef} className={LIST_CARD}>
        <ColumnsBar
          registry={ACTION_COLUMNS}
          keys={columns}
          listed={() => true}
          onChange={setColumns}
          onReset={resetColumns}
          leading={data.length > 0 && <FilterMenu categories={filterCategories} />}
        />
        <Table>
          <TableHeader>
            <TableRow className={LIST_HEAD_ROW}>
              {visible.map((c) => (
                <TableHead key={c.key} className={`${HEAD} ${CELLS[c.key].head ?? ""}`}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead className={`${HEAD} w-[60px]`} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              // No actions exist at all, in any department this user can
              // read. Distinct from the filtered-empty state below: nothing
              // was hidden, there was nothing to hide.
              <TableRow>
                <TableCell colSpan={colCount} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 py-6">
                    <ListChecks className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-ink">No open actions</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      No actions have been created yet.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleCount === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-48 text-center">
                  <FilterEmptyState noun="actions" onClear={clearFilters} />
                </TableCell>
              </TableRow>
            ) : (
              filtered.slice(pager.start, pager.end).map((row) => (
                <TableRow key={row.id} className={listRow(false, false)}>
                  {visible.map((c) => (
                    <TableCell key={c.key} className={CELLS[c.key].cell} title={CELLS[c.key].title?.(row)}>
                      {CELLS[c.key].render(row)}
                    </TableCell>
                  ))}
                  <TableCell>
                    {canManage(row.departmentId) && <UpdateActionStatusButton action={row} />}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        {/* When every match fits on one page the pager is hidden, and
            with it the count; this puts the count back in its place. */}
        <ListPagination
          pager={pager}
          scrollTarget={cardRef}
          summary={
            data.length > 0 &&
            (statusFilter.length === 0 && priorityFilter.length === 0
              ? `${data.length} ${data.length === 1 ? "action" : "actions"}`
              : `${visibleCount} of ${data.length} actions`)
          }
        />
      </div>
    </div>
  )
}
