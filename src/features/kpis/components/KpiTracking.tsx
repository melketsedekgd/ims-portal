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
import ShareDialog from "@/features/shares/components/ShareDialog"
import { downloadTable, type ExportFormat } from "@/lib/export/download"

import MeasurementDialog from "@/features/kpis/components/MeasurementDialog"
import FilterChips, { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
import { PILL, KPI_STATUS } from "@/components/shared/status-styles"
import type { KpiTrackingRow } from "@/features/kpis/queries"
import type { KpiStatus } from "@/features/kpis/types"
import type { PeriodEntryState } from "@/features/periods/queries"
import { KPI_COLUMNS, type KpiColumnKey } from "@/features/kpis/columns"
import ColumnsBar from "@/components/shared/ColumnsBar"
import { useColumnChoice } from "@/features/table-preferences/components/ColumnChoiceProvider"

// The four statuses toStatus() in kpis/queries.ts can assign, in display
// order. Not re-derived here: the row's status is the query's word.
const STATUS_FILTER: { value: KpiStatus; label: string }[] = [
  { value: "Achieved", label: "Achieved" },
  { value: "Deviated", label: "Deviated" },
  { value: "Pending", label: "Pending" },
  { value: "Not Measured", label: "Not Measured" },
]

const HEAD = "h-10 text-xs font-medium text-slate-500"
const TEXT = "text-muted-foreground text-sm truncate"

/**
 * How each registry column renders. A Record, so a column added to
 * KPI_COLUMNS without a renderer here fails the typecheck. Labels come
 * from the registry; only layout lives here.
 */
const CELLS: Record<
  KpiColumnKey,
  { head?: string; cell?: string; title?: (row: KpiTrackingRow) => string; render: (row: KpiTrackingRow) => React.ReactNode }
> = {
  // The min width keeps the name readable when a wide set of columns makes
  // the table scroll inside its card.
  metric: {
    head: "pl-3 min-w-[200px]",
    cell: "font-medium min-w-[200px] max-w-[250px] pl-3",
    render: (row) => (
      <div className="flex items-center gap-2 truncate" title={row.name}>
        <span className="truncate">{row.name}</span>
      </div>
    ),
  },
  dept: { head: "w-[72px]", render: (row) => <DeptTag code={row.departmentCode} /> },
  responsibility: {
    cell: `${TEXT} max-w-[150px]`,
    title: (row) => row.responsibility ?? "",
    render: (row) => row.responsibility || "-",
  },
  target: { cell: "tabular-nums", render: (row) => row.target },
  actual: { cell: "font-semibold tabular-nums", render: (row) => row.actual || "-" },
  achievement: {
    head: "text-right",
    cell: "text-right text-sm font-medium tabular-nums",
    render: (row) => row.achievementPercentage || "-",
  },
  status: { render: (row) => <span className={`${PILL} ${KPI_STATUS[row.status]}`}>{row.status}</span> },
  remark: {
    cell: `${TEXT} max-w-[300px]`,
    title: (row) => row.justification ?? "",
    render: (row) => row.justification || "-",
  },
  data_source: {
    cell: `${TEXT} max-w-[200px]`,
    title: (row) => row.dataSource ?? "",
    render: (row) => row.dataSource || "—",
  },
  frequency: { cell: "text-sm", render: (row) => row.analysisFrequency || "—" },
  methodology: {
    cell: `${TEXT} max-w-[300px]`,
    title: (row) => row.analysisMethodology ?? "",
    render: (row) => row.analysisMethodology || "—",
  },
  evidence: {
    cell: `${TEXT} max-w-[200px]`,
    title: (row) => row.evidenceNames.join(", "),
    render: (row) => row.evidenceNames.join(", ") || "—",
  },
}

export default function KpiTracking({
  initialData,
  year,
  quarter,
  years,
  period,
  canCreate,
  departmentFilter,
}: {
  initialData: KpiTrackingRow[]
  year: string
  quarter: string
  years: number[]
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
  const { keys: columns, set: setColumns, reset: resetColumns, multiDepartment } = useColumnChoice(KPI_COLUMNS)
  const visible = KPI_COLUMNS.columns.filter(
    (c) => columns.includes(c.key) && (c.key !== "dept" || showDept)
  )
  // +2 for the checkbox and actions columns.
  const colCount = visible.length + 2
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
  // The ids as they were when Share was pressed: the dialog loads names
  // for exactly these, and a live Set would reload it on every tick.
  const [sharing, setSharing] = useState<string[] | null>(null)
  const handleExport = async (format: ExportFormat) => {
    setExporting(true)
    try {
      // The columns on screen, so the file matches the table.
      const result = await exportKpis([...selected], Number(year), quarter, [...columns])
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      await downloadTable(
        { ...result, fileName: `kpis-${year}-${quarter}` },
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
            <PeriodPicker year={year} quarter={quarter} years={years} />
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
      {/* min-w-0: the card never widens the page; a wide set of columns
          scrolls inside the table's own container, under the bar. */}
      <div className="min-w-0 rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <ColumnsBar
          registry={KPI_COLUMNS}
          keys={columns}
          listed={(key) => key !== "dept" || multiDepartment}
          onChange={setColumns}
          onReset={resetColumns}
        />
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              {/* One step taller on phones so the checkbox's 44px tap
                  area is not clipped by the table's scroll container. */}
              <TableHead className="h-10 w-[44px] pl-4 pr-0 max-md:h-11">
                <SelectCheckbox
                  label="Select all KPIs shown"
                  checked={shownIds.length > 0 && shownSelected === shownIds.length}
                  indeterminate={shownSelected > 0 && shownSelected < shownIds.length}
                  onChange={(on) => setMany(shownIds, on)}
                />
              </TableHead>
              {visible.map((c) => (
                <TableHead key={c.key} className={`${HEAD} ${CELLS[c.key].head ?? ""}`}>
                  {c.label}
                </TableHead>
              ))}
              <TableHead className={`${HEAD} w-[90px]`}></TableHead>
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
                      {visible.map((c) => {
                        const def = CELLS[c.key]
                        return (
                          <TableCell key={c.key} className={def.cell} title={def.title?.(row) || undefined}>
                            {def.render(row)}
                          </TableCell>
                        )
                      })}
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
        onShare={() => setSharing([...selected])}
        onClear={clear}
      />

      {sharing && (
        <ShareDialog
          type="kpi"
          ids={sharing}
          year={Number(year)}
          quarter={quarter}
          onClose={() => setSharing(null)}
          onShared={() => {
            setSharing(null)
            clear()
          }}
        />
      )}
    </div>
  )
}