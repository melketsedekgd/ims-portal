"use client"

import { useState } from "react"
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
import FilterChips, { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
import { PILL, ACTION_STATUS } from "@/components/shared/status-styles"
import NewActionButton from "@/features/action-items/components/NewActionButton"
import UpdateActionStatusButton from "@/features/action-items/components/UpdateActionStatusButton"
import type { Action } from "@/features/action-items/queries"
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

function isOverdue(a: Action) {
  if (!a.dueDate) return false
  if (a.status === "completed" || a.status === "cancelled") return false
  return a.dueDate < new Date().toISOString().slice(0, 10)
}

export default function ActionsList({
  initialData,
  departments,
  canManageDepartmentIds,
}: {
  initialData: Action[]
  /** Creatable departments, for the standalone "New action" entrance. */
  departments: { id: string; name: string; code: string }[]
  /** Department ids the current user can edit actions in, or "all" for an IMS admin. */
  canManageDepartmentIds: string[] | "all"
}) {
  const data = initialData

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

  const visibleCount = data.filter(matches).length
  const clearFilters = () => {
    setStatusFilter([])
    setPriorityFilter([])
  }

  const canManage = (departmentId: string) =>
    canManageDepartmentIds === "all" || canManageDepartmentIds.includes(departmentId)

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Actions"
        description="Work assigned against risks, KPIs, objectives and other findings."
        actions={<NewActionButton departments={departments} />}
      />

      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <FilterChips
              label="Filter actions by status"
              options={statusCounts}
              selected={statusFilter}
              onChange={setStatusFilter}
            />
            <FilterChips
              label="Filter actions by priority"
              options={priorityCounts}
              selected={priorityFilter}
              onChange={setPriorityFilter}
            />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">
            {statusFilter.length === 0 && priorityFilter.length === 0
              ? `${data.length} ${data.length === 1 ? "action" : "actions"}`
              : `${visibleCount} of ${data.length} actions`}
          </span>
        </div>
      )}

      <div className="rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="h-10 text-xs font-medium text-slate-500 pl-6">Title</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Department</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Source</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Owner</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Priority</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Due</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Status</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 w-[60px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              // No actions exist at all, in any department this user can
              // read. Distinct from the filtered-empty state below: nothing
              // was hidden, there was nothing to hide.
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 py-6">
                    <ListChecks className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">No open actions</p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      No actions have been created yet.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleCount === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
                  <FilterEmptyState noun="actions" onClear={clearFilters} />
                </TableCell>
              </TableRow>
            ) : (
              data.filter(matches).map((row) => {
                const overdue = isOverdue(row)
                return (
                  <TableRow key={row.id} className="h-12">
                    <TableCell className="font-medium max-w-[260px] pl-6">
                      <div className="truncate" title={row.title}>
                        {row.title}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {row.departmentName ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {SOURCE_LABEL[row.sourceType]}
                    </TableCell>
                    <TableCell
                      className="text-muted-foreground text-sm max-w-[150px] truncate"
                      title={row.ownerTitle ?? undefined}
                    >
                      {row.ownerTitle || "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {row.priority
                        ? PRIORITY_FILTER.find((p) => p.value === String(row.priority))?.label ??
                          row.priority
                        : "—"}
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      <span
                        className={
                          overdue
                            ? "text-rose-600 dark:text-rose-400 font-medium inline-flex items-center gap-1"
                            : ""
                        }
                      >
                        {overdue && <AlertCircle className="h-3.5 w-3.5" />}
                        {fmtDate(row.dueDate)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`${PILL} ${ACTION_STATUS[row.status]}`}>
                        {STATUS_LABEL[row.status]}
                      </span>
                    </TableCell>
                    <TableCell>
                      {canManage(row.departmentId) && <UpdateActionStatusButton action={row} />}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
