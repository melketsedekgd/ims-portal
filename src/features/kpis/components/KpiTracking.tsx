"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileSpreadsheet, Lock, ChevronDown, ChevronRight, SquarePen } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import MeasurementDialog from "@/features/kpis/components/MeasurementDialog"
import FilterChips, { countBy, FilterEmptyState } from "@/components/shared/FilterChips"
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
}: {
  initialData: KpiTrackingRow[]
  year: string
  quarter: string
  /** null when the URL names a quarter that has no reporting_periods row. */
  period: PeriodEntryState | null
  /** Decided on the server from the user's roles; the client never checks roles. */
  canCreate: boolean
}) {
  const router = useRouter()
  // Read from props, not copied into state: after a measurement is saved the
  // server action revalidates this route and new rows arrive as props, and
  // the instance is reused (same period, same key), so a useState(initialData)
  // copy would keep showing the pre-save values.
  const data = initialData
  const [measuring, setMeasuring] = useState<KpiTrackingRow | null>(null)

  // Status filter — component state, not the URL. The period decides what is
  // fetched; this only hides rows already here. Counts are taken from the
  // full set so they never move as chips toggle.
  const [statusFilter, setStatusFilter] = useState<KpiStatus[]>([])
  const statusCounts = countBy(data, STATUS_FILTER, (row) => row.status)
  const matches = (row: KpiTrackingRow) =>
    statusFilter.length === 0 || statusFilter.includes(row.status)
  const visibleCount = data.filter(matches).length

  // URL-driven state updates
  const setPeriod = (next: { year?: string; quarter?: string }) => {
    const params = new URLSearchParams({
      year: next.year ?? year,
      quarter: next.quarter ?? quarter,
    })
    router.push(`?${params.toString()}`)
  }


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

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight">KPI Tracking</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Key Performance Indicators and input quarterly actuals.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ── Period Picker ── */}
          <Select value={quarter} onValueChange={(v) => v && setPeriod({ quarter: v })}>
            <SelectTrigger className="w-[80px] h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Q1","Q2","Q3","Q4"].map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={(v) => v && setPeriod({ year: v })}>
            <SelectTrigger className="w-[90px] h-9 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button
              className="gap-2 h-9"
              onClick={() => router.push("/department/kpis/new")}
            >
              <Plus className="h-4 w-4" />
              Create KPI
            </Button>
          )}
        </div>
      </div>

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
          <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Metric</TableHead>
              <TableHead className="h-10">Responsibility</TableHead>
              <TableHead className="h-10">Target</TableHead>
              <TableHead className="h-10">Actual</TableHead>
              <TableHead className="h-10">Achiev. %</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10">Remark/Justification</TableHead>
              <TableHead className="h-10 w-[90px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              // A period with nothing in it. Distinct from the filtered state
              // below: nothing was hidden, there was nothing to hide.
              <TableRow>
                <TableCell colSpan={8} className="h-48 text-center">
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
                <TableCell colSpan={8} className="h-48 text-center">
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
                    <TableCell colSpan={8} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        }
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                          {processName}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">
                          ({kpis.length} {kpis.length === 1 ? "metric" : "metrics"})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed ? kpis.map((row) => {
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => router.push(`/department/kpis/${row.id}?year=${year}&quarter=${quarter}`)}
                      className="transition-colors cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    >
                      <TableCell className="font-medium max-w-[250px] pl-6">
                        <div className="flex items-center gap-2 truncate" title={row.name}>
                          <span className="truncate">{row.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate" title={row.responsibility}>
                        {row.responsibility || "-"}
                      </TableCell>
                      <TableCell>{row.target}</TableCell>
                      <TableCell className="font-semibold">{row.actual || "-"}</TableCell>
                      <TableCell className="text-sm font-medium">{row.achievementPercentage || "-"}</TableCell>
                      <TableCell>
                        {row.status === "Achieved" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Achieved</Badge>
                        ) : row.status === "Deviated" ? (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Deviated</Badge>
                        ) : row.status === "Not Measured" ? (
                          <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400 shadow-none border-transparent">Not Measured</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                        )}
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
    </div>
  )
}