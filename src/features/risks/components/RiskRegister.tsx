"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShieldAlert, Lock, ChevronDown, ChevronRight, SquarePen, X } from "lucide-react"

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
import { SelectCheckbox, useRowSelection } from "@/components/shared/RowSelection"
import SelectionBar from "@/components/shared/SelectionBar"
import { toast } from "sonner"
import { exportRisks } from "@/features/risks/export"
import ShareDialog from "@/features/shares/components/ShareDialog"
import { downloadTable, type ExportFormat } from "@/lib/export/download"

import type { RiskStatus } from "@/components/forms/RiskForm"
import type { RiskListItem } from "@/features/risks/queries"
import type { PeriodEntryState } from "@/features/periods/queries"
import { riskBand, RISK_BAND_LABEL, type RiskBand } from "@/features/risks/scoring"
import AssessmentDialog from "@/features/risks/components/AssessmentDialog"
import RiskHeatMap, { heatCellParam, inHeatCell, parseHeatCell, type HeatCell } from "@/features/risks/components/RiskHeatMap"
import { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
import FilterMenu, { type FilterCategory } from "@/components/shared/FilterMenu"
import { PILL, SCORE, RISK_SCORE, RISK_STATUS } from "@/components/shared/status-styles"
import { RISK_COLUMNS, type RiskColumnKey } from "@/features/risks/columns"
import ColumnsBar from "@/components/shared/ColumnsBar"
import { useColumnChoice } from "@/features/table-preferences/components/ColumnChoiceProvider"

const STATUS_FILTER: { value: RiskStatus; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "Mitigating", label: "Mitigating" },
  { value: "Closed", label: "Closed" },
  { value: "Retired", label: "Retired" },
]

// The four bands riskBand() can assign, in severity order, labelled from the
// one place the thresholds live. A row is banded with riskBand(score), never
// by comparing the score here — `null < 5` is true, and that put 12
// unassessed risks on a green "Low" chip.
const BAND_FILTER: { value: RiskBand; label: string }[] = (
  ["critical", "medium", "low", "not_assessed"] as const
).map((value) => ({ value, label: RISK_BAND_LABEL[value] }))

// ── Status presentation ──
//
// Thresholds live in features/risks/scoring.ts; the look of each band and
// status lives in components/shared/status-styles.ts. A score is a fixed
// square holding the number — a different shape from the status pills, so
// a critical 20 never reads as a deviated KPI. A risk with no residual
// assessment in the selected period has no score; rendering 0 would read
// as "0 · Low", which is a different and false claim, so it gets a dashed
// square with a dash.
function ScoreBadge({ score }: { score: number | null }) {
  const band = riskBand(score)
  return (
    <span className={`${SCORE} ${RISK_SCORE[band]}`} title={RISK_BAND_LABEL[band]}>
      {score === null ? "—" : score}
    </span>
  )
}

// Status is not severity: neutral outline pills. Retired is dashed so a
// reader of a historical quarter can tell "withdrawn" from "resolved".
function StatusBadge({ status }: { status: RiskStatus }) {
  return <span className={`${PILL} ${RISK_STATUS[status]}`}>{status}</span>
}

// Closed risks are resolved; retired ones are historical. Neither is editable
// from the register.
const isLocked = (risk: RiskListItem) =>
  risk.status === "Closed" || risk.status === "Retired"

const HEAD = "h-10 text-xs font-medium text-slate-500"
const TEXT = "text-muted-foreground text-sm truncate"

/**
 * How each registry column renders. A Record, so a column added to
 * RISK_COLUMNS without a renderer here fails the typecheck. Labels come
 * from the registry; only layout lives here.
 */
const CELLS: Record<
  RiskColumnKey,
  { head?: string; cell?: string; title?: (row: RiskListItem) => string; render: (row: RiskListItem) => React.ReactNode }
> = {
  // The min width keeps the title readable when a wide set of columns makes
  // the table scroll inside its card.
  risk: {
    head: "pl-3 min-w-[220px]",
    cell: "font-medium min-w-[220px] max-w-[280px] pl-3",
    render: (row) => (
      <div className="flex items-center gap-2 truncate" title={row.title}>
        {isLocked(row) && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
        <span className="truncate">{row.title}</span>
      </div>
    ),
  },
  dept: { head: "w-[72px]", render: (row) => <DeptTag code={row.departmentCode} /> },
  ref: {
    head: "w-[56px] text-center",
    cell: "text-center text-xs text-muted-foreground tabular-nums",
    render: (row) => row.referenceNumber ?? "—",
  },
  ls: {
    head: "w-[80px] text-center",
    cell: "text-center",
    render: (row) => (
      <span className="text-xs text-muted-foreground tabular-nums">
        {row.likelihood === null || row.severity === null
          ? "—"
          : `${row.likelihood} × ${row.severity}`}
      </span>
    ),
  },
  score: { head: "w-[90px] text-right", cell: "text-right", render: (row) => <ScoreBadge score={row.riskScore} /> },
  band: { cell: "text-sm", render: (row) => RISK_BAND_LABEL[riskBand(row.riskScore)] },
  status: { render: (row) => <StatusBadge status={row.status} /> },
  owner: {
    cell: `${TEXT} max-w-[180px]`,
    title: (row) => row.ownerTitle ?? "",
    render: (row) => row.ownerTitle || "—",
  },
  affected_assets: {
    cell: `${TEXT} max-w-[200px]`,
    title: (row) => row.affectedAssets,
    render: (row) => row.affectedAssets || "—",
  },
  threat: {
    cell: `${TEXT} max-w-[220px]`,
    title: (row) => row.threat ?? "",
    render: (row) => row.threat || "—",
  },
  vulnerability: {
    cell: `${TEXT} max-w-[220px]`,
    title: (row) => row.vulnerability ?? "",
    render: (row) => row.vulnerability || "—",
  },
  treatment: {
    cell: `${TEXT} max-w-[300px]`,
    title: (row) => row.treatment ?? "",
    render: (row) => row.treatment || "—",
  },
}

export default function RiskRegister({
  initialData,
  year,
  quarter,
  years,
  period,
  departmentFilter,
}: {
  initialData: RiskListItem[]
  year: string
  quarter: string
  years: number[]
  /** null when the URL names a quarter that has no reporting_periods row. */
  period: PeriodEntryState | null
  /** IMS only: the department dropdown, rendered by the page. null for everyone else. */
  departmentFilter?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Read from props, not copied into state: after a rating is saved the
  // server action revalidates this route and new rows arrive as props, and
  // the instance is reused (same period, same key), so a useState(initialData)
  // copy would keep showing the pre-save scores.
  const data = initialData

  // More than one department in the list — "All departments" for IMS —
  // is when rows need saying whose they are.
  const showDept = spansDepartments(data)
  const { keys: columns, set: setColumns, reset: resetColumns, multiDepartment } = useColumnChoice(RISK_COLUMNS)
  const visible = RISK_COLUMNS.columns.filter(
    (c) => columns.includes(c.key) && (c.key !== "dept" || showDept)
  )
  // +2 for the checkbox and actions columns.
  const colCount = visible.length + 2
  const { selected, toggle, setMany, clear } = useRowSelection()
  const [assessing, setAssessing] = useState<RiskListItem | null>(null)

  // Filters — component state, not the URL.
  const [statusFilter, setStatusFilter] = useState<RiskStatus[]>([])
  const [bandFilter, setBandFilter] = useState<RiskBand[]>([])

  const statusCounts = countBy(data, STATUS_FILTER, (row) => row.status)
  const bandCounts = countBy(data, BAND_FILTER, (row) => riskBand(row.riskScore))

  // Map square filter — in the URL (?ls=L-S), unlike the band chips, so a
  // square can be linked to and survives opening a risk and coming back.
  // Written with history.pushState, which Next syncs into useSearchParams
  // without re-running the page's query: this only hides rows already
  // here. The period and department pickers drop it.
  const mapCell = parseHeatCell(searchParams.get("ls"))
  const setMapCell = (cell: HeatCell | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (cell) params.set("ls", heatCellParam(cell))
    else params.delete("ls")
    const query = params.toString()
    window.history.pushState(null, "", query ? `${pathname}?${query}` : pathname)
  }



  // The filters combine: a row shows when it passes all active filters.
  const matches = (row: RiskListItem) =>
    (statusFilter.length === 0 || statusFilter.includes(row.status)) &&
    (bandFilter.length === 0 || bandFilter.includes(riskBand(row.riskScore))) &&
    (mapCell === null || inHeatCell(row, mapCell))

  // The square's own count, over the full list like the map's number —
  // not what the band chips leave of it.
  const mapCellCount = mapCell ? data.filter((row) => inHeatCell(row, mapCell)).length : 0
  const visibleCount = data.filter(matches).length
  const clearFilters = () => {
    setStatusFilter([])
    setBandFilter([])
    if (mapCell) setMapCell(null)
  }

  const filterCategories: FilterCategory[] = [
    {
      id: "status",
      label: "Status",
      options: statusCounts,
      selected: statusFilter,
      onChange: (next) => setStatusFilter(next as RiskStatus[]),
    },
    {
      id: "score",
      label: "Score Band",
      options: bandCounts,
      selected: bandFilter,
      onChange: (next) => setBandFilter(next as RiskBand[]),
    },
  ]

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

  // "Select all" acts on the rows on screen: past the band chips and the
  // map square, and not inside a collapsed group. Ticked rows elsewhere — another department,
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
      const result = await exportRisks([...selected], Number(year), quarter, [...columns])
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      await downloadTable(
        { ...result, fileName: `risks-${year}-${quarter}` },
        format
      )
    } catch {
      toast.error("The export could not be built. Try again.")
    } finally {
      setExporting(false)
    }
  }

  const activeRisks = data.filter((r) => r.status === "Open" || r.status === "Mitigating")
  const totalActiveRisks = activeRisks.length
  const highCriticalRisks = activeRisks.filter((r) => (r.riskScore ?? 0) >= 15).length
  const risksRequiringAction = activeRisks.filter((r) => r.status === "Open" || !r.treatment).length

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6 relative">
      {/* No "Log Risk" entrance until createRisk lands — a risk also needs a
          baseline assessment, which is its own brief. */}
      <PageHeader
        title="Risks"
        description="Identify, assess, and track risks that threaten departmental objectives."
      />

      {/* ── Summary Cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Active Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalActiveRisks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High / Critical Risks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{highCriticalRisks}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Risks Requiring Action</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{risksRequiringAction}</div>
          </CardContent>
        </Card>
      </div>

      {/* ── Risk map ── */}
      {data.length > 0 && (
        <RiskHeatMap risks={data} showDept={showDept} selected={mapCell} onSelect={setMapCell} />
      )}

      {/* ── Table Toolbar (Filters & Period) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {data.length > 0 && (
            <FilterMenu categories={filterCategories} onClearAll={clearFilters} />
          )}
          {mapCell && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#0f172a] pl-3 pr-1 text-xs h-9 text-white">
              Likelihood {mapCell.likelihood} × Severity {mapCell.severity} · {mapCellCount}{" "}
              {mapCellCount === 1 ? "risk" : "risks"}
              <button
                type="button"
                data-hit-area
                aria-label="Clear map filter"
                onClick={() => setMapCell(null)}
                className="relative flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/15"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </button>
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {departmentFilter}
          <PeriodPicker year={year} quarter={quarter} years={years} />
        </div>
      </div>

      {/* ── Risk Data Table ── */}
      {/* min-w-0: the card never widens the page; a wide set of columns
          scrolls inside the table's own container, under the bar. */}
      <div className="min-w-0 rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <ColumnsBar
          registry={RISK_COLUMNS}
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
                  label="Select all risks shown"
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
                    <ShieldAlert className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      No risks recorded for {quarter} {year}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      There are no risks on the register for this reporting period. Switch to a different period.
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : visibleCount === 0 ? (
              <TableRow>
                <TableCell colSpan={colCount} className="h-48 text-center">
                  <FilterEmptyState noun="risks" onClear={clearFilters} />
                </TableCell>
              </TableRow>
            ) : (() => {
              const groups = data.reduce<Record<string, RiskListItem[]>>((acc, risk) => {
                const key = risk.processName || "General"
                if (!acc[key]) acc[key] = []
                acc[key].push(risk)
                return acc
              }, {})

              // Filter after grouping, and drop a group the filter empties
              // rather than rendering a header over nothing.
              return Object.entries(groups).flatMap(([processName, allRisks]) => {
                const risks = allRisks.filter(matches)
                if (risks.length === 0) return []
                const isCollapsed = collapsedProcesses.has(processName)
                return [
                  // ── Process Section Header Row ──
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
                          {risks.length} {risks.length === 1 ? "risk" : "risks"}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed ? risks.map((row) => {
                    const locked = isLocked(row)
                    const isSelected = selected.has(row.id)
                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => router.push(`/department/risks/${row.id}?year=${year}&quarter=${quarter}`)}
                        aria-selected={isSelected}
                        className={`h-12 transition-colors cursor-pointer ${isSelected ? "bg-[#f1f5f9] hover:bg-[#f1f5f9]" : "hover:bg-slate-50"} ${locked ? `${isSelected ? "" : "bg-slate-50/60"} opacity-80` : ""}`}
                      >
                        <TableCell className="w-[44px] pl-4 pr-0" onClick={(e) => e.stopPropagation()}>
                          <SelectCheckbox
                            label={`Select ${row.title}`}
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
                            {period && !locked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-400 hover:text-[var(--ink)] hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors z-10 relative"
                                title={period.status === "closed" ? `${quarter} ${year} is closed` : "Rate residual risk"}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setAssessing(row)
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
                                <span>{row.status}</span>
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

      {assessing && period && (
        <AssessmentDialog
          key={assessing.id}
          risk={assessing}
          period={period}
          periodLabel={`${quarter} ${year}`}
          onClose={() => setAssessing(null)}
        />
      )}

      {/* Counts every ticked row, including ones the department filter,
          the chips or another period have taken off screen. */}
      <SelectionBar
        count={selected.size}
        singular="risk"
        plural="risks"
        onExport={handleExport}
        exporting={exporting}
        onShare={() => setSharing([...selected])}
        onClear={clear}
      />

      {sharing && (
        <ShareDialog
          type="risk"
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
