"use client"

import { useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ShieldAlert, Lock, ChevronDown, ChevronRight, SquarePen, X, Plus } from "lucide-react"

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
import type { RiskListItem, RiskScoreContext } from "@/features/risks/queries"
import type { PeriodEntryState } from "@/features/periods/queries"
import { riskBand, RISK_BAND_LABEL, type RiskBand, type ScoredRiskBand } from "@/features/risks/scoring"
import AssessmentDialog from "@/features/risks/components/AssessmentDialog"
import RiskHeatMap, { heatCellParam, inHeatCell, parseHeatCell, type HeatCell } from "@/features/risks/components/RiskHeatMap"
import { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
import FilterMenu, { type FilterCategory } from "@/components/shared/FilterMenu"
import { PILL, SCORE, RISK_SCORE, RISK_STATUS } from "@/components/shared/status-styles"
import {
  LIST_CARD,
  LIST_GROUP_CHIP,
  LIST_GROUP_ROW,
  LIST_HEAD,
  LIST_HEAD_ROW,
  listRow,
} from "@/components/shared/list-styles"
import { RISK_COLUMNS, type RiskColumnKey } from "@/features/risks/columns"
import ColumnsBar from "@/components/shared/ColumnsBar"
import ListPagination, { groupPage, orderByGroup, usePagination } from "@/components/shared/ListPagination"
import { useColumnChoice } from "@/features/table-preferences/components/ColumnChoiceProvider"

const STATUS_FILTER: { value: RiskStatus; label: string }[] = [
  { value: "Open", label: "Open" },
  { value: "Mitigating", label: "Mitigating" },
  { value: "Closed", label: "Closed" },
  { value: "Retired", label: "Retired" },
]

// The summary cards: one per scored band, each a filter (?band=), in
// place of a band option in the filter popover. There is no High —
// riskBand() has three scored bands. A row is banded with
// riskBand(score), never by comparing the score here: `null < 5` is
// true, and that once put 12 unassessed risks on a green "Low" chip. The ranges are the
// thresholds in scoring.ts, spelled out for the reader, as the map legend.
const BAND_CARDS: { band: ScoredRiskBand; range: string }[] = [
  { band: "low", range: "1–4" },
  { band: "medium", range: "5–14" },
  { band: "critical", range: "15–25" },
]

/** ?band=low|medium|critical. Anything else is no filter: the URL is hand-editable. */
function parseBandParam(value: string | null): ScoredRiskBand | null {
  return value === "low" || value === "medium" || value === "critical" ? value : null
}

// ── Status presentation ──
//
// Thresholds live in features/risks/scoring.ts; the look of each band and
// status lives in components/shared/status-styles.ts. A score is a fixed
// square holding the number — a different shape from the status pills, so
// a critical 20 never reads as a deviated KPI. A risk with no residual
// assessment in the selected period has no score; rendering 0 would read
// as "0 · Low", which is a different and false claim, so it gets a dashed
// square with a dash.
function ScoreBadge({
  score,
  empty = "—",
  label,
}: {
  score: number | null
  /** What an unscored square says. */
  empty?: string
  /** Prefix for the tooltip: "Baseline", "Q2 2026". */
  label: string
}) {
  const band = riskBand(score)
  return (
    <span
      className={`${SCORE} ${RISK_SCORE[band]} ${score === null ? "w-auto min-w-9 px-1.5 font-medium" : ""}`}
      title={`${label}: ${score === null ? empty : `${score} · ${RISK_BAND_LABEL[band]}`}`}
    >
      {score === null ? empty : score}
    </span>
  )
}

/**
 * Baseline → residual: the pre-treatment rating, then this period's. Each
 * square is banded on its own score. No residual for the period reads "Not
 * scored" on a pending square — never blank, never 0, which would claim a
 * Low rating nobody gave. A risk with no baseline shows a pending dash.
 */
function RpnChips({ row, baseline, period }: { row: RiskListItem; baseline: number | null; period: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <ScoreBadge score={baseline} label="Baseline" />
      <span className="text-xs text-muted-foreground" aria-hidden>→</span>
      <ScoreBadge score={row.riskScore} empty="Not scored" label={period} />
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

const HEAD = LIST_HEAD
const processOf = (row: RiskListItem) => row.processName || "General"
const TEXT = "text-muted-foreground text-sm truncate"

/**
 * How each registry column renders. A Record, so a column added to
 * RISK_COLUMNS without a renderer here fails the typecheck. Labels come
 * from the registry; only layout lives here.
 */
const CELLS: Record<
  RiskColumnKey,
  {
    head?: string
    cell?: string
    title?: (row: RiskListItem) => string
    /** `ctx` carries what the row itself does not: its baseline, and the period label. */
    render: (row: RiskListItem, ctx: { baseline: number | null; period: string }) => React.ReactNode
  }
> = {
  // The min width keeps the title readable when a wide set of columns makes
  // the table scroll inside its card.
  risk: {
    head: "pl-3 min-w-[220px]",
    cell: "font-medium min-w-[220px] max-w-[280px] pl-3",
    render: (row) => (
      <div className="flex items-center gap-2 truncate" title={row.title}>
        {isLocked(row) && <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
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
  score: {
    head: "w-[170px] text-right",
    cell: "text-right",
    render: (row, ctx) => <RpnChips row={row} baseline={ctx.baseline} period={ctx.period} />,
  },
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
  scoreContext,
  year,
  quarter,
  years,
  period,
  canCreate,
  departmentFilter,
}: {
  initialData: RiskListItem[]
  /** Each risk's baseline and previous score, by id, for the review dialog. */
  scoreContext: Record<string, RiskScoreContext>
  year: string
  quarter: string
  years: number[]
  /** null when the URL names a quarter that has no reporting_periods row. */
  period: PeriodEntryState | null
  /** The user may create a risk in at least one department. */
  canCreate: boolean
  /** IMS only: the department dropdown, rendered by the page. null for everyone else. */
  departmentFilter?: React.ReactNode
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Read from props, not copied into state: after a review is saved the
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

  const statusCounts = countBy(data, STATUS_FILTER, (row) => row.status)

  // Map square filter — in the URL (?ls=L-S), unlike the popover filters, so a
  // square can be linked to and survives opening a risk and coming back.
  // Written with history.pushState, which Next syncs into useSearchParams
  // without re-running the page's query: this only hides rows already
  // here. The period and department pickers drop it.
  //
  // The summary cards' band (?band=) works the same way. The two never
  // combine: picking one drops the other, so a card and a square cannot
  // leave an empty table between them.
  const mapCell = parseHeatCell(searchParams.get("ls"))
  const cardBand = parseBandParam(searchParams.get("band"))
  const pushParams = (edit: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString())
    edit(params)
    const query = params.toString()
    window.history.pushState(null, "", query ? `${pathname}?${query}` : pathname)
  }
  const setMapCell = (cell: HeatCell | null) =>
    pushParams((params) => {
      params.delete("band")
      if (cell) params.set("ls", heatCellParam(cell))
      else params.delete("ls")
    })
  const setCardBand = (band: ScoredRiskBand | null) =>
    pushParams((params) => {
      params.delete("ls")
      if (band) params.set("band", band)
      else params.delete("band")
    })

  // The filters combine: a row shows when it passes all active filters.
  const matches = (row: RiskListItem) =>
    (statusFilter.length === 0 || statusFilter.includes(row.status)) &&
    (cardBand === null || riskBand(row.riskScore) === cardBand) &&
    (mapCell === null || inHeatCell(row, mapCell))

  // The square's own count, over the full list like the map's number —
  // not what the status filter leaves of it.
  const mapCellCount = mapCell ? data.filter((row) => inHeatCell(row, mapCell)).length : 0
  // Grouped by process, then filtered, then paged. A group can split
  // across pages; its header is repeated at the top of the next one.
  const filtered = orderByGroup(data, processOf).filter(matches)
  const visibleCount = filtered.length
  // Back to page 1 when what matches changes: the URL (department, period,
  // ?band, ?ls) or a filter.
  const pager = usePagination(
    visibleCount,
    JSON.stringify([searchParams.toString(), statusFilter])
  )
  const pageGroups = groupPage(filtered, processOf, pager.start, pager.end)
  const clearFilters = () => {
    setStatusFilter([])
    if (mapCell || cardBand) pushParams((params) => {
      params.delete("ls")
      params.delete("band")
    })
  }

  const filterCategories: FilterCategory[] = [
    {
      id: "status",
      label: "Status",
      options: statusCounts,
      selected: statusFilter,
      onChange: (next) => setStatusFilter(next as RiskStatus[]),
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

  // "Select all" acts on the rows on screen: past the filters, the band
  // card and the map square, on this page, and not inside a collapsed
  // group. Ticked rows elsewhere — another page, another department,
  // another chip — are left as they are.
  const shownIds = pageGroups
    .filter((g) => !collapsedProcesses.has(g.name))
    .flatMap((g) => g.rows.map((row) => row.id))
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

  // Active risks (Open, Mitigating) in the department and period on
  // screen — never what the band, square or popover filters leave, so
  // moving from one card to another always means the same thing. Only the
  // count is active-only: pressing a card filters by band alone.
  const cardCounts = new Map<RiskBand, number>()
  for (const row of data) {
    if (row.status !== "Open" && row.status !== "Mitigating") continue
    const band = riskBand(row.riskScore)
    cardCounts.set(band, (cardCounts.get(band) ?? 0) + 1)
  }

  return (
    <div className="flex-1 space-y-6 w-full max-w-[1440px] mx-auto p-4 md:p-6 relative">
      <PageHeader
        title="Risks"
        description="Identify, assess, and track risks that threaten departmental objectives."
        actions={
          <>
          {/* IMS's department filter sits with the period: both narrow what
              the list is about, and both live in the URL. */}
          {departmentFilter}
          <PeriodPicker year={year} quarter={quarter} years={years} />
            {canCreate && (
              <Button
                className="gap-2 h-9"
                onClick={() => router.push("/department/risks/new")}
              >
                <Plus className="h-4 w-4" />
                New risk
              </Button>
            )}
          </>
        }
      />

      {/* ── Summary Cards ── each a band filter. Pressed: a coral outline.
          90% of the old card's height: no gap under the title row, a
          14px gap to the number in place of 8 + 16. */}
      <div className="grid gap-4 md:grid-cols-3">
        {BAND_CARDS.map(({ band, range }) => {
          const pressed = cardBand === band
          const count = cardCounts.get(band) ?? 0
          return (
            <button
              key={band}
              type="button"
              aria-pressed={pressed}
              onClick={() => setCardBand(pressed ? null : band)}
              className="group/band rounded-[22px] text-left outline-none focus-visible:ring-2 focus-visible:ring-coral-600 focus-visible:ring-offset-2"
            >
              <Card
                className={`h-full gap-3.5 transition-colors group-hover/band:bg-white/85 ${pressed ? "ring-2 ring-coral" : ""}`}
              >
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Active · {RISK_BAND_LABEL[band]} · score {range}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold tabular-nums">{count}</div>
                </CardContent>
              </Card>
            </button>
          )
        })}
      </div>

      {/* ── Risk map ── */}
      {data.length > 0 && (
        <RiskHeatMap risks={data} showDept={showDept} selected={mapCell} onSelect={setMapCell} />
      )}

      {/* ── Map square filter chip ── the filter button itself is in the
          list's header strip, beside the columns control. */}
      {mapCell && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full bg-coral-tint pl-3 pr-1 text-xs font-medium h-9 text-coral-600">
            Likelihood {mapCell.likelihood} × Severity {mapCell.severity} · {mapCellCount}{" "}
            {mapCellCount === 1 ? "risk" : "risks"}
            <button
              type="button"
              data-hit-area
              aria-label="Clear map filter"
              onClick={() => setMapCell(null)}
              className="relative flex h-7 w-7 items-center justify-center rounded-full hover:bg-coral-600/10"
            >
              <X className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
            </button>
          </span>
        </div>
      )}

      {/* ── Risk Data Table ── */}
      {/* min-w-0: the card never widens the page; a wide set of columns
          scrolls inside the table's own container, under the bar. */}
      <div className={LIST_CARD}>
        <ColumnsBar
          registry={RISK_COLUMNS}
          keys={columns}
          listed={(key) => key !== "dept" || multiDepartment}
          onChange={setColumns}
          onReset={resetColumns}
          leading={
            data.length > 0 && (
              <FilterMenu categories={filterCategories} onClearAll={clearFilters} appearance="glass" />
            )
          }
        />
        <Table>
          <TableHeader>
            <TableRow className={LIST_HEAD_ROW}>
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
                    <p className="text-sm font-medium text-ink">
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
            ) : (
              pageGroups.flatMap(({ name: processName, rows: risks, total, continued }) => {
                const isCollapsed = collapsedProcesses.has(processName)
                return [
                  // ── Process Section Header Row ──
                  // Repeated, marked "continued", on a page the group runs onto.
                  <TableRow
                    key={`group-${processName}`}
                    className={LIST_GROUP_ROW}
                    onClick={() => toggleProcess(processName)}
                  >
                    <TableCell colSpan={colCount} className="px-4 pt-4 pb-1.5">
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                        }
                        <span className={LIST_GROUP_CHIP} title={processName}>
                          <span className="truncate">{processName}</span>
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {total} {total === 1 ? "risk" : "risks"}
                          {continued && " · continued"}
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
                        className={`${listRow(isSelected)} ${locked ? `${isSelected ? "" : "bg-ink/[0.02]"} opacity-80` : ""}`}
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
                              {def.render(row, {
                                baseline: scoreContext[row.id]?.baseline ?? null,
                                period: `${quarter} ${year}`,
                              })}
                            </TableCell>
                          )
                        })}
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {period && !locked && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-ink hover:bg-ink/5 transition-colors z-10 relative"
                                title={period.status === "closed" ? `${quarter} ${year} is closed` : "Quarterly review"}
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
                              <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium px-1">
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
            )}
          </TableBody>
        </Table>
        <ListPagination pager={pager} />
      </div>

      {assessing && period && (
        <AssessmentDialog
          key={assessing.id}
          risk={assessing}
          context={scoreContext[assessing.id]}
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
