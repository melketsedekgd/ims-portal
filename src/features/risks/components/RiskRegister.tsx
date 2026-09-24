"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShieldAlert, Lock, ChevronDown, ChevronRight, SquarePen } from "lucide-react"

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
import { exportRisks } from "@/features/risks/export"
import { RISK_EXPORT_COLUMNS } from "@/features/risks/export-columns"
import { downloadTable, type ExportFormat } from "@/lib/export/download"

import type { RiskStatus } from "@/components/forms/RiskForm"
import type { RiskListItem } from "@/features/risks/queries"
import type { PeriodEntryState } from "@/features/periods/queries"
import { riskBand, RISK_BAND_LABEL, type RiskBand } from "@/features/risks/scoring"
import AssessmentDialog from "@/features/risks/components/AssessmentDialog"
import FilterChips, { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
import { PILL, SCORE, RISK_SCORE, RISK_STATUS } from "@/components/shared/status-styles"

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

export default function RiskRegister({
  initialData,
  year,
  quarter,
  period,
  departmentFilter,
}: {
  initialData: RiskListItem[]
  year: string
  quarter: string
  /** null when the URL names a quarter that has no reporting_periods row. */
  period: PeriodEntryState | null
  /** IMS only: the department dropdown, rendered by the page. null for everyone else. */
  departmentFilter?: React.ReactNode
}) {
  const router = useRouter()
  // Read from props, not copied into state: after a rating is saved the
  // server action revalidates this route and new rows arrive as props, and
  // the instance is reused (same period, same key), so a useState(initialData)
  // copy would keep showing the pre-save scores.
  const data = initialData

  // More than one department in the list — "All departments" for IMS —
  // is when rows need saying whose they are.
  const showDept = spansDepartments(data)
  // +1 for the checkbox column.
  const colCount = 6 + (showDept ? 1 : 0)
  const { selected, toggle, setMany, clear } = useRowSelection()
  const [assessing, setAssessing] = useState<RiskListItem | null>(null)

  // Band filter — component state, not the URL. The period decides what is
  // fetched; this only hides rows already here. Counts are taken from the
  // full set so they never move as chips toggle.
  const [bandFilter, setBandFilter] = useState<RiskBand[]>([])
  const bandCounts = countBy(data, BAND_FILTER, (row) => riskBand(row.riskScore))
  const matches = (row: RiskListItem) =>
    bandFilter.length === 0 || bandFilter.includes(riskBand(row.riskScore))
  const visibleCount = data.filter(matches).length

  // Closed risks are resolved; retired ones are historical. Neither is editable
  // from the register.
  const isLocked = (risk: RiskListItem) =>
    risk.status === "Closed" || risk.status === "Retired"

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

  // "Select all" acts on the rows on screen: past the band chips and not
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
      const result = await exportRisks([...selected], Number(year), quarter)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      if (result.rows.length === 0) {
        toast.error(`None of the selected risks are on the ${quarter} ${year} list.`)
        return
      }
      await downloadTable(
        { ...result, columns: RISK_EXPORT_COLUMNS, fileName: `risks-${year}-${quarter}` },
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
      {/* No "Log Risk" entrance until createRisk lands — a risk also needs a
          baseline assessment, which is its own brief. */}
      <PageHeader
        title="Risk Register"
        description="Identify, assess, and track risks that threaten departmental objectives."
        actions={
          <>
            {departmentFilter}
            <PeriodPicker year={year} quarter={quarter} />
          </>
        }
      />

      {/* ── Band filter ── */}
      {data.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterChips
            label="Filter risks by score band"
            options={bandCounts}
            selected={bandFilter}
            onChange={setBandFilter}
          />
          <span className="text-xs text-muted-foreground tabular-nums">
            {bandFilter.length === 0
              ? `${data.length} ${data.length === 1 ? "risk" : "risks"}`
              : `${visibleCount} of ${data.length} risks`}
          </span>
        </div>
      )}

      {/* ── Risk Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-slate-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="h-10 w-[44px] pl-4 pr-0">
                <SelectCheckbox
                  label="Select all risks shown"
                  checked={shownIds.length > 0 && shownSelected === shownIds.length}
                  indeterminate={shownSelected > 0 && shownSelected < shownIds.length}
                  onChange={(on) => setMany(shownIds, on)}
                />
              </TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 pl-3">Risk</TableHead>
              {showDept && <TableHead className="h-10 text-xs font-medium text-slate-500 w-[72px]">Dept</TableHead>}
              <TableHead className="h-10 text-xs font-medium text-slate-500 w-[80px] text-center">L × S</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500 w-[90px] text-right">Score</TableHead>
              <TableHead className="h-10 text-xs font-medium text-slate-500">Status</TableHead>
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
                  <FilterEmptyState noun="risks" onClear={() => setBandFilter([])} />
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
                        <TableCell className="font-medium max-w-[280px] pl-3">
                          <div className="flex items-center gap-2 truncate" title={row.title}>
                            {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                            <span className="truncate">{row.title}</span>
                          </div>
                        </TableCell>
                        {showDept && (
                          <TableCell>
                            <DeptTag code={row.departmentCode} />
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {row.likelihood === null || row.severity === null
                              ? "—"
                              : `${row.likelihood} × ${row.severity}`}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <ScoreBadge score={row.riskScore} />
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
        onClear={clear}
      />
    </div>
  )
}
