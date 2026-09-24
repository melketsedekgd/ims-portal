"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Plus, FileSpreadsheet, Lock, ChevronDown, ChevronRight, SquarePen } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import PageHeader from "@/components/shared/PageHeader"
import PeriodPicker from "@/components/shared/PeriodPicker"
import DeptTag, { spansDepartments } from "@/components/shared/DeptTag"
import { SelectCheckbox, useRowSelection } from "@/components/shared/RowSelection"
import SelectionBar from "@/components/shared/SelectionBar"
import { toast } from "sonner"
import { exportKpis } from "@/features/kpis/export"
import { KPI_EXPORT_COLUMNS } from "@/features/kpis/export-columns"
import { downloadTable, type ExportFormat } from "@/lib/export/download"

import MeasurementDialog from "@/features/kpis/components/MeasurementDialog"
import FilterChips, { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
import { PILL, KPI_STATUS } from "@/components/shared/status-styles"
import type { KpiTrackingRow } from "@/features/kpis/queries"
import type { KpiStatus } from "@/features/kpis/types"
import type { PeriodEntryState } from "@/features/periods/queries"

// The four statuses toStatus() in kpis/queries.ts can assign, in display
// order. Not re-derived here: the row's status is the query's word.
const STATUS_FILTER: { value: KpiStatus; label: string }[] = [
  { value: "Achieved", label: "Achieved" },
  { value: "Deviated", label: "Deviated" },
  { value: "Pending", label: "Pending" },
  { value: "Not Measured", label: "Not Measured" },
]

export default function KpiTracking({
  initialData,
  year,
  quarter,
  period,
  canCreate,
  departmentFilter,
}: {
  initialData: KpiTrackingRow[]
  year: string
  quarter: string
  /** null when the URL names a quarter that has no reporting_periods row. */
  period: PeriodEntryState | null
  /** Decided on the server from the user's roles; the client never checks roles. */
  canCreate: boolean
  /** IMS only: the department dropdown, rendered by the page. null for everyone else. */
  departmentFilter?: React.ReactNode
}) {
  const router = useRouter()
  // Read from props, not copied into state: after a measurement is saved the
  // server action revalidates this route and new rows arrive as props, and
  // the instance is reused (same period, same key), so a useState(initialData)
  // copy would keep showing the pre-save values.
  const data = initialData

  // More than one department in the list — "All departments" for IMS —
  // is when rows need saying whose they are.
  const showDept = spansDepartments(data)
  // +1 for the checkbox column.
  const colCount = 9 + (showDept ? 1 : 0)
  const { selected, toggle, setMany, clear } = useRowSelection()
  const [measuring, setMeasuring] = useState<KpiTrackingRow | null>(null)

  // Status filter — component state, not the URL. The period decides what is
  // fetched; this only hides rows already here. Counts are taken from the
  // full set so they never move as chips toggle.
  const [statusFilter, setStatusFilter] = useState<KpiStatus[]>([])
  const statusCounts = countBy(data, STATUS_FILTER, (row) => row.status)
  const matches = (row: KpiTrackingRow) =>
    statusFilter.length === 0 || statusFilter.includes(row.status)
  const visibleCount = data.filter(matches).length


  // Collapsible process groups — all expanded by default
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

  // "Select all" acts on the rows on screen: past the status chips and not
  // inside a collapsed group. Ticked rows elsewhere — another department,
  // another chip — are left as they are.
  const shownIds = data
    .filter((row) => matches(row) && !collapsedProcesses.has(row.processName || "General"))
    .map((row) => row.id)
  const shownSelected = shownIds.filter((id) => selected.has(id)).length

  // Every ticked id goes, on screen or not, for the period on screen. The
  // action reads them under RLS; the file is built here from what it returns.
  const [exporting, setExporting] = useState(false)
  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      const result = await exportKpis([...selected], Number(year), quarter)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      await downloadTable(
        { ...result, columns: KPI_EXPORT_COLUMNS, fileName: `kpis-${year}-${quarter}` },
        format
      )
    } catch {
      toast.error("The export could not be built. Try again.")
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6 relative">
      <PageHeader
        title="KPI Tracking"
        description="Manage your Key Performance Indicators and input quarterly actuals."
        actions={
          <>
            {departmentFilter}
            <PeriodPicker year={year} quarter={quarter} />
            {canCreate && (
              <Button
                className="gap-2 h-9"
                onClick={() => router.push("/department/kpis/new")}
              >
                <Plus className="h-4 w-4" />
                Create KPI
              </Button>
            )}
          </>
        }
      />

      {/* ── Status filter ── */}
      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            label="Filter KPIs by status"
            options={statusCounts}
            selected={statusFilter}
            onChange={setStatusFilter}
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {statusFilter.length === 0
              ? `${data.length} ${data.length === 1 ? "KPI" : "KPIs"}`
              : `${visibleCount} of ${data.length} KPIs`}
          </span>
        </div>
      )}

      {/* ── KPI Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="h-10 w-[44px] pl-4 pr-0">
                <SelectCheckbox
                  label="Select all KPIs shown"
                  checked={shownIds.length > 0 && shownSelected === shownIds.length}
                  indeterminate={shownSelected > 0 && shownSelected < shownIds.length}
                  onChange={(on) => setMany(shownIds, on)}
                />
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 pl-3">Metric</TableHead>
              {showDept && <TableHead className="h-10 text-xs font-medium text-slate-500 w-[72px]">Dept</TableHead>}
              <TableHead className="h-10 text-xs font-medium text-slate-500">Responsibility</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Target</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Actual</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 text-right">Achievement</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Status</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Remark / justification</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              // A period with nothing in it. Distinct from the filtered state
              // below: nothing was hidden, there was nothing to hide.
              <TableRow>
                <TableCell colSpan={colCount} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 py-6">
                    <FileSpreadsheet className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      No KPIs found for {quarter} {year}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      There are no KPIs for this reporting period. Switch to a different period.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleCount === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-48 text-center">
                  <FilterEmptyState noun="KPIs" onClear={() => setStatusFilter([])} />
                </TableCell>
              </TableRow>
            ) : (() => {
              // Group KPIs by processName, preserving insertion order
              const groups = data.reduce<Record<string, KpiTrackingRow[]>>((acc, kpi) => {
                const key = kpi.processName || "General"
                if (!acc[key]) acc[key] = []
                acc[key].push(kpi)
                return acc
              }, {})

              // Filter after grouping, and drop a group the filter empties
              // rather than rendering a header over nothing.
              return Object.entries(groups).flatMap(([processName, allKpis]) => {
                const kpis = allKpis.filter(matches)
                if (kpis.length === 0) return []
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
                          {kpis.length} {kpis.length === 1 ? "metric" : "metrics"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed ? kpis.map((row) => {
                  const isSelected = selected.has(row.id)
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => router.push(`/department/kpis/${row.id}?year=${year}&quarter=${quarter}`)}
                      aria-selected={isSelected}
                      className={`h-12 transition-colors cursor-pointer ${isSelected ? "bg-[#f1f5f9] hover:bg-[#f1f5f9]" : "hover:bg-slate-50"}`}
                    >
                      <TableCell className="w-[44px] pl-4 pr-0" onClick={(e) => e.stopPropagation()}>
                        <SelectCheckbox
                          label={`Select ${row.name}`}
                          checked={isSelected}
                          onChange={() => toggle(row.id)}
                        />
                      </TableCell>
                      <TableCell className="font-medium max-w-[250px] pl-3">
                        <div className="flex items-center gap-2 truncate" title={row.name}>
                          <span className="truncate">{row.name}</span>
                        </div>
                      </TableCell>
                      {showDept && (
                        <TableCell>
                          <DeptTag code={row.departmentCode} />
                        </TableCell>
                      )}
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={row.responsibility}>
                        {row.responsibility || "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">{row.target}</TableCell>
                      <TableCell className="font-semibold tabular-nums">{row.actual || "-"}</TableCell>
                      <TableCell className="text-right text-sm font-medium tabular-nums">{row.achievementPercentage || "-"}</TableCell>
                      <TableCell>
                        <span className={`${PILL} ${KPI_STATUS[row.status]}`}>{row.status}</span>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate" title={row.justification}>
                        {row.justification || "-"}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {period && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-[var(--ink)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10 relative"
                              title={period.status === "closed" ? `${quarter} ${year} is closed` : "Log measurement"}
                              onClick={(e) => {
                                e.stopPropagation();
                                setMeasuring(row);
                              }}
                            >
                              {period.status === "closed"
                                ? <Lock className="h-4 w-4" />
                                : <SquarePen className="h-4 w-4" />}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                }) : [])
              ]})
            })()}
          </TableBody>
        </Table>
      </div>

      {/* ── Measurement Entry Dialog ── */}
      {measuring && period && (
        <MeasurementDialog
          key={measuring.id}
          kpi={measuring}
          period={period}
          periodLabel={`${quarter} ${year}`}
          onClose={() => setMeasuring(null)}
        />
      )}

      {/* Counts every ticked row, including ones the department filter,
          the chips or another period have taken off screen. */}
      <SelectionBar
        count={selected.size}
        singular="KPI"
        plural="KPIs"
        onExport={handleExport}
        exporting={exporting}
        onClear={clear}
      />
    </div>
  )
}