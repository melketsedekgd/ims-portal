"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus, Target, Lock, ChevronDown, ChevronRight, SquarePen } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import PageHeader from "@/components/shared/PageHeader"
import PeriodPicker from "@/components/shared/PeriodPicker"
import DeptTag, { spansDepartments } from "@/components/shared/DeptTag"

import type {
  ObjectiveListItem,
  ObjectiveLifecycle,
  ObjectiveOutcome,
} from "@/features/objectives/queries"
import type { PeriodEntryState } from "@/features/periods/queries"
import MeasurementDialog from "@/features/objectives/components/MeasurementDialog"
import FilterChips, { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
import FilterMenu from "@/components/shared/FilterMenu"
import { PILL, OBJECTIVE_OUTCOME, OBJECTIVE_LIFECYCLE } from "@/components/shared/status-styles"

const STATUS_FILTER: { value: ObjectiveLifecycle; label: string }[] = [
  { value: "Active", label: "Active" },
  { value: "Achieved", label: "Achieved" },
  { value: "Retired", label: "Retired" },
]

const OUTCOME_FILTER: { value: ObjectiveOutcome; label: string }[] = [
  { value: "measured", label: "Measured" },
  { value: "not_measured", label: "Not measured" },
  { value: "completed_earlier", label: "Completed earlier" },
  { value: "not_reported", label: "Not reported" },
]

// ── Lifecycle: a fact about the objective, independent of the period ──
function StatusBadge({ status }: { status: ObjectiveLifecycle }) {
  return <span className={`${PILL} ${OBJECTIVE_LIFECYCLE[status]}`}>{status}</span>
}

// ── Outcome: what this period's report actually said ──
//
// The four cases are different claims and none of them is zero. A percentage
// is only ever shown when a snapshot exists and says something.
function AchievementCell({ row }: { row: ObjectiveListItem }) {
  switch (row.outcome) {
    case "measured":
      return (
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-sm font-semibold tabular-nums">
            {row.achievement === null ? "—" : `${Math.round(row.achievement * 100)}%`}
          </span>
          {row.activitiesTotal !== null && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {row.activitiesCompleted ?? 0} of {row.activitiesTotal} activities
            </span>
          )}
        </div>
      )
    case "not_measured":
      // Explicitly N/A for the period. Not zero, and excluded from averages.
      return <span className={`${PILL} ${OBJECTIVE_OUTCOME.not_measured}`}>N/A</span>
    case "completed_earlier":
      // Done in an earlier quarter and dropped off this report. The emerald
      // "Achieved" badge already carries the good news, so this stays plain
      // text rather than double-signalling it.
      return (
        <span className="text-xs text-muted-foreground italic">
          Completed in an earlier period
        </span>
      )
    case "not_reported":
      // The only case that means "outstanding".
      return <span className={`${PILL} ${OBJECTIVE_OUTCOME.not_reported}`}>Not reported</span>
  }
}

export default function ObjectivesTable({
  initialData,
  year,
  quarter,
  years,
  period,
  canCreate,
  departmentFilter,
}: {
  initialData: ObjectiveListItem[]
  year: string
  quarter: string
  years: number[]
  /** null when the URL names a quarter that has no reporting_periods row. */
  period: PeriodEntryState | null
  /**
   * Whether this user manages at least one department or is an IMS admin —
   * the only callers objectives_insert accepts. Decided on the server; the
   * button is hidden rather than rendered to fail on submit.
   */
  canCreate: boolean
  /** IMS only: the department dropdown, rendered by the page. null for everyone else. */
  departmentFilter?: React.ReactNode
}) {
  const router = useRouter()
  // Read from props, not copied into state: after a save the server action
  // revalidates this route and new rows arrive as props, and the instance is
  // reused (same period, same key), so a useState(initialData) copy would
  // keep showing the pre-save figures.
  const data = initialData

  // More than one department in the list — "All departments" for IMS —
  // is when rows need saying whose they are.
  const showDept = spansDepartments(data)
  const colCount = 5 + (showDept ? 1 : 0)
  const [measuring, setMeasuring] = useState<ObjectiveListItem | null>(null)

  const periodLabel = `${quarter} ${year}`

  // Status & outcome filters — component state, not the URL. The period decides what
  // is fetched; this only hides rows already here. Counts are taken from the
  // full set so they never move as chips toggle.
  const [statusFilter, setStatusFilter] = useState<ObjectiveLifecycle[]>([])
  const [outcomeFilter, setOutcomeFilter] = useState<ObjectiveOutcome[]>([])

  const statusCounts = countBy(data, STATUS_FILTER, (row) => row.status)
  const outcomeCounts = countBy(data, OUTCOME_FILTER, (row) => row.outcome)

  const matches = (row: ObjectiveListItem) =>
    (statusFilter.length === 0 || statusFilter.includes(row.status)) &&
    (outcomeFilter.length === 0 || outcomeFilter.includes(row.outcome))

  const visibleCount = data.filter(matches).length

  const filterCategories = [
    {
      id: "status",
      label: "Status",
      options: statusCounts,
      selected: statusFilter,
      onChange: setStatusFilter,
    },
    {
      id: "outcome",
      label: "Outcome",
      options: outcomeCounts,
      selected: outcomeFilter,
      onChange: setOutcomeFilter,
    },
  ]

  // Achieved objectives are done; retired ones are historical. Neither is
  // editable from the list.
  const isLocked = (obj: ObjectiveListItem) =>
    obj.status === "Achieved" || obj.status === "Retired"

  // Collapsible process groups
  const [collapsedProcesses, setCollapsedProcesses] = useState<Set<string>>(new Set())

  const toggleProcess = (processName: string) => {
    setCollapsedProcesses(prev => {
      const next = new Set(prev)
      if (next.has(processName)) {
        next.delete(processName)
      } else {
        next.add(processName)
      }
      return next
    })
  }

  const totalObjectives = data.length
  const achievedObjectives = data.filter((row) => row.status === "Achieved").length
  const achievementRate = totalObjectives > 0 ? Math.round((achievedObjectives / totalObjectives) * 100) : 0

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6 relative">
      <PageHeader
        title="Objectives"
        description="Define and track departmental objectives and their quarterly progress."
        actions={
          canCreate ? (
            <Button
              className="gap-2 h-9"
              onClick={() => router.push("/department/objectives/new")}
            >
              <Plus className="h-4 w-4" />
              Create Objective
            </Button>
          ) : null
        }
      />

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total IMS Objectives</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalObjectives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Objectives Achieved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{achievedObjectives}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Achievement Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{achievementRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Table Toolbar (Filters & Period) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {data.length > 0 && (
            <FilterMenu categories={filterCategories} />
          )}
        </div>
        <div className="flex items-center gap-2">
          {departmentFilter}
          <PeriodPicker year={year} quarter={quarter} years={years} />
        </div>
      </div>

      {/* ── Objectives Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <Table className="table-fixed">
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="h-10 text-xs font-medium text-slate-500 pl-6">Objective</TableHead>
              {showDept && <TableHead className="h-10 text-xs font-medium text-slate-500 w-[72px]">Dept</TableHead>}
              <TableHead className="h-10 text-xs font-medium text-slate-500 w-[130px]">Target date</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 w-[170px] text-right">Achievement</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 w-[130px]">Status</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 py-6">
                    <Target className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      No objectives found for {periodLabel}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      There are no registered objectives for this reporting period.
                      {canCreate ? " You can create a new objective or switch to a different period." : " Switch to a different period."}
                    </p>
                    {canCreate && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 text-xs gap-1.5"
                        onClick={() => router.push("/department/objectives/new")}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        Create Objective
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleCount === 0 ? (
              // The filter hid every row — not the same fact as the empty
              // period above, so it reads differently and offers to clear.
              <TableRow>
                <TableCell colSpan={colCount} className="h-48 text-center">
                  <FilterEmptyState noun="objectives" onClear={() => { setStatusFilter([]); setOutcomeFilter([]); }} />
                </TableCell>
              </TableRow>
            ) : (() => {
              const groups = data.reduce<Record<string, ObjectiveListItem[]>>((acc, obj) => {
                const key = obj.processName || "General"
                if (!acc[key]) acc[key] = []
                acc[key].push(obj)
                return acc
              }, {})

              // Filter after grouping, and drop a group the filter empties
              // rather than rendering a header over nothing.
              return Object.entries(groups).flatMap(([processName, allObjs]) => {
                const objs = allObjs.filter(matches)
                if (objs.length === 0) return []
                const isCollapsed = collapsedProcesses.has(processName)
                return [
                  // ── Process Section Header Row (clickable toggle) ──
                  <TableRow
                    key={`group-${processName}`}
                    className="bg-slate-50/80 dark:bg-slate-900/60 hover:bg-slate-100/80 dark:hover:bg-slate-900/80 cursor-pointer select-none"
                    onClick={() => toggleProcess(processName)}
                  >
                    <TableCell colSpan={colCount} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        }
                        <span className="text-sm font-medium text-ink-2">
                          {processName}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {objs.length} {objs.length === 1 ? "objective" : "objectives"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed ? objs.map((row) => {
                    const locked = isLocked(row)
                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => router.push(`/department/objectives/${row.id}?year=${year}&quarter=${quarter}`)}
                        className={`h-12 transition-colors cursor-pointer hover:bg-slate-50 ${locked ? "bg-slate-50/60 opacity-80" : ""}`}
                      >
                        {/* Titles run to full paragraphs — some IT objectives are
                            ~400 characters — so the cell clamps to two lines and
                            keeps the full text in the tooltip. */}
                        <TableCell className="pl-6 py-1">
                          <div className="flex items-start gap-2">
                            {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span
                                className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-2"
                                title={row.name}
                              >
                                {row.name}
                              </span>
                              {row.description && (
                                <p
                                  className="text-xs text-muted-foreground line-clamp-1"
                                  title={row.description}
                                >
                                  {row.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        {showDept && (
                          <TableCell>
                            <DeptTag code={row.departmentCode} />
                          </TableCell>
                        )}
                        <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">
                          {row.targetDate ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <AchievementCell row={row} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {period && !locked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-[var(--ink)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10 relative"
                                title={period.status === "closed" ? `${periodLabel} is closed` : "Record progress"}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setMeasuring(row)
                                }}
                              >
                                {period.status === "closed"
                                  ? <Lock className="h-4 w-4" />
                                  : <SquarePen className="h-4 w-4" />}
                              </Button>
                            )}
                            {locked && (
                              <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 font-medium px-1">
                                <Lock className="h-3 w-3" />
                              </div>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  }) : [])
                ]
              })
            })()}
          </TableBody>
        </Table>
      </div>

      {measuring && period && (
        <MeasurementDialog
          key={measuring.id}
          objective={measuring}
          period={period}
          periodLabel={periodLabel}
          onClose={() => setMeasuring(null)}
        />
      )}
    </div>
  )
}
