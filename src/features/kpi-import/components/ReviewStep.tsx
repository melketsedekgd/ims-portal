"use client"

import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PILL } from "@/components/shared/status-styles"
import { cn } from "@/lib/utils"
import { reportWording } from "@/features/kpis/parse-actual"
import Choice from "./Choice"
import {
  excludeImportRow,
  excludeUnmatchedRows,
  saveImportRow,
  setReplaceExisting,
} from "../mutations"
import type { ImportReview, ReviewRow } from "../queries"
import { ISSUE_TEXT, normaliseName } from "../review"
import type { DraftMap } from "./MappingStep"

const STATUS: Record<ReviewRow["status"], { label: string; className: string }> = {
  ready: { label: "✓ Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  check: { label: "! Check", className: "bg-amber-50 text-amber-800 border-amber-200" },
  excluded: { label: "✕ Excluded", className: "bg-slate-100 text-slate-600 border-transparent" },
  imported: { label: "✓ Imported", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  skipped: { label: "Skipped", className: "bg-transparent border-dashed border-slate-300 text-slate-500" },
}

type Tab = "all" | "attention" | "ready" | "excluded"

/**
 * Step 4: every staged row, with a drawer to correct the selected one. Each
 * change is saved to import_rows as it is made, so the rows on screen are
 * always what commit_import will read.
 */
export default function ReviewStep({
  review,
  map,
  onRows,
  footer,
}: {
  review: ImportReview
  /** The mapping the rows were staged with: which raw cells to show. */
  map: DraftMap
  /** Replaces rows in the wizard's copy of the review after a save. */
  onRows: (update: (rows: ReviewRow[]) => ReviewRow[]) => void
  footer: React.ReactNode
}) {
  const [tab, setTab] = useState<Tab>("all")
  const [selectedId, setSelectedId] = useState<string | null>(
    () => (review.rows.find((r) => r.status === "check") ?? review.rows[0])?.id ?? null
  )
  const [pending, startTransition] = useTransition()

  const kpiById = useMemo(() => new Map(review.kpis.map((k) => [k.id, k])), [review.kpis])
  const unitLabel = useMemo(() => {
    const m = new Map(review.units.map((u) => [u.key, u.label]))
    return (key: string | null) => (key ? (m.get(key) ?? key) : "")
  }, [review.units])

  const rows = review.rows
  const counts = {
    all: rows.length,
    ready: rows.filter((r) => r.status === "ready").length,
    attention: rows.filter((r) => r.status === "check").length,
    excluded: rows.filter((r) => r.status === "excluded").length,
  }
  const unmatched = rows.filter((r) => r.status === "check" && !r.kpiId).length
  const withExisting = rows.filter((r) => r.kpiId && r.status !== "excluded" && review.existing[r.kpiId] !== undefined)
  const allReplace = withExisting.length > 0 && withExisting.every((r) => r.replaceExisting)

  const shown = rows.filter((r) =>
    tab === "all" ? true : tab === "attention" ? r.status === "check" : r.status === tab
  )
  const selected = rows.find((r) => r.id === selectedId) ?? null

  const patch = (row: ReviewRow) => onRows((rs) => rs.map((r) => (r.id === row.id ? row : r)))

  const setReplace = (rowId: string | null, value: boolean) =>
    startTransition(async () => {
      const result = await setReplaceExisting(review.batchId, rowId, value)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      onRows((rs) => rs.map((r) => (rowId === null || r.id === rowId ? { ...r, replaceExisting: value } : r)))
    })

  const excludeUnmatched = () =>
    startTransition(async () => {
      const result = await excludeUnmatchedRows(review.batchId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      const ids = new Set(result.rowIds)
      onRows((rs) => rs.map((r) => (ids.has(r.id) ? { ...r, status: "excluded" } : r)))
    })

  const actualText = (r: ReviewRow) => {
    if (r.notMeasured) return "N/A"
    if (r.actualValue === null) return "—"
    return reportWording(r.actualText) ?? `${r.actualValue} ${unitLabel(r.actualUnit)}`.trim()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "all", label: `All ${counts.all}` },
    { key: "attention", label: `Needs attention ${counts.attention}` },
    { key: "ready", label: `Ready ${counts.ready}` },
    { key: "excluded", label: `Excluded ${counts.excluded}` },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row gap-5 items-start">
        {/* ── Rows ── */}
        <div className="flex-1 min-w-0 w-full rounded-lg border overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-b">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  role="tab"
                  aria-selected={tab === t.key}
                  data-slot="tab"
                  onClick={() => setTab(t.key)}
                  className={cn(
                    "h-8 px-3 rounded-md text-xs border",
                    tab === t.key
                      ? "bg-ink text-white border-ink dark:bg-slate-100 dark:text-slate-900"
                      : "bg-white border-slate-300 dark:bg-slate-950 dark:border-slate-700"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {unmatched > 0 && (
                <Button variant="outline" size="sm" disabled={pending} onClick={excludeUnmatched}>
                  Exclude {unmatched} unmatched
                </Button>
              )}
              {withExisting.length > 0 && (
                <Button variant="outline" size="sm" disabled={pending} onClick={() => setReplace(null, !allReplace)}>
                  {allReplace ? "Replace none" : `Replace all ${withExisting.length}`}
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-auto max-h-[640px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2 w-12">Row</th>
                  <th className="text-left font-medium px-3 py-2">KPI</th>
                  <th className="text-left font-medium px-3 py-2 w-24">Target</th>
                  <th className="text-left font-medium px-3 py-2 w-32">Result</th>
                  <th className="text-left font-medium px-3 py-2 w-44">Already recorded</th>
                  <th className="text-left font-medium px-3 py-2 w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const kpi = r.kpiId ? kpiById.get(r.kpiId) : undefined
                  const sheetName = map.kpi_name ? (r.raw[map.kpi_name] ?? "") : ""
                  const sub =
                    kpi && normaliseName(sheetName) !== normaliseName(kpi.name)
                      ? `In sheet: ${sheetName || "—"}`
                      : (kpi?.processName ?? `In sheet: ${sheetName || "—"}`)
                  const existing = r.kpiId ? review.existing[r.kpiId] : undefined
                  return (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedId(r.id)}
                      aria-selected={r.id === selectedId}
                      className={cn(
                        "border-t cursor-pointer align-top",
                        r.id === selectedId
                          ? "bg-ink/5 shadow-[inset_3px_0_0_var(--color-ink)]"
                          : "hover:bg-slate-50 dark:hover:bg-slate-900"
                      )}
                    >
                      <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{r.rowNumber}</td>
                      <td className="px-3 py-2 max-w-0 w-full">
                        <div className={cn("truncate", !kpi && "italic text-muted-foreground")} title={kpi?.name}>
                          {kpi?.name ?? "No matching KPI"}
                        </div>
                        <div className="truncate text-xs text-muted-foreground" title={sub}>{sub}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{kpi?.target || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{actualText(r)}</td>
                      <td className="px-3 py-2 text-xs">
                        {existing === undefined ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <label
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              data-slot="checkbox"
                              className="h-4 w-4 accent-blue-600"
                              checked={r.replaceExisting}
                              disabled={pending || r.status === "excluded"}
                              onChange={(e) => setReplace(r.id, e.target.checked)}
                            />
                            <span className="font-mono truncate" title={existing}>
                              {existing || "—"}
                            </span>
                            <span className="text-muted-foreground">
                              {r.replaceExisting ? "replace" : "keep"}
                            </span>
                          </label>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={cn(PILL, STATUS[r.status].className)}>{STATUS[r.status].label}</span>
                      </td>
                    </tr>
                  )
                })}
                {shown.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                      No rows here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Drawer ── */}
        {selected && (
          <RowEditor
            // Reset the fields whenever another row is picked or this one is saved.
            key={`${selected.id}-${selected.status}-${selected.kpiId}-${selected.actualValue}-${selected.actualUnit}-${selected.notMeasured}`}
            row={selected}
            review={review}
            map={map}
            onSaved={patch}
          />
        )}
      </div>

      {footer}
    </div>
  )
}

function RowEditor({
  row,
  review,
  map,
  onSaved,
}: {
  row: ReviewRow
  review: ImportReview
  map: DraftMap
  onSaved: (row: ReviewRow) => void
}) {
  const [kpiId, setKpiId] = useState(row.kpiId ?? "")
  const [value, setValue] = useState(row.actualValue?.toString() ?? "")
  const [unit, setUnit] = useState(row.actualUnit ?? "")
  const [notMeasured, setNotMeasured] = useState(row.notMeasured)
  const [pending, startTransition] = useTransition()

  const kpi = review.kpis.find((k) => k.id === kpiId)
  // Only units that can be scored against the KPI's target are offered.
  const dimension = review.units.find((u) => u.key === kpi?.targetUnit)?.dimension
  const units = review.units.filter((u) => !dimension || u.dimension === dimension)
  const unitValue = units.some((u) => u.key === unit) ? unit : (kpi?.targetUnit ?? "")

  const sheetName = map.kpi_name ? row.raw[map.kpi_name] : undefined
  const sheetValue = map.actual ? row.raw[map.actual] : undefined
  const note = row.status === "excluded" ? null : row.issue ? ISSUE_TEXT[row.issue] : null
  const primary = row.status === "ready" ? "Save changes" : row.status === "excluded" ? "Include row" : "Confirm"

  const save = () => {
    const actualValue = notMeasured || value.trim() === "" ? null : Number(value)
    if (actualValue !== null && Number.isNaN(actualValue)) {
      toast.error("Enter the result as a number.")
      return
    }
    startTransition(async () => {
      const result = await saveImportRow(row.id, {
        kpiId,
        actualValue,
        actualUnit: notMeasured ? null : unitValue || null,
        notMeasured,
      })
      if (result.ok) onSaved(result.row)
      else toast.error(result.message)
    })
  }

  const exclude = () =>
    startTransition(async () => {
      const result = await excludeImportRow(row.id)
      if (result.ok) onSaved(result.row)
      else toast.error(result.message)
    })

  return (
    <aside className="w-full lg:w-[360px] shrink-0 rounded-lg border p-4 space-y-4 lg:sticky lg:top-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-muted-foreground">Sheet row {row.rowNumber}</span>
        <span className={cn(PILL, STATUS[row.status].className)}>{STATUS[row.status].label}</span>
      </div>

      <div className="rounded-md border bg-slate-50 dark:bg-slate-900 p-3 space-y-1">
        <p className="text-xs text-muted-foreground">As written in the sheet</p>
        <p className="text-sm">{sheetName || "—"}</p>
        <p className="font-mono text-sm text-muted-foreground">{sheetValue || "—"}</p>
      </div>

      {note && (
        <p className="rounded-md bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200 px-3 py-2 text-sm">
          {note}
        </p>
      )}

      <div className="space-y-2">
        <Label htmlFor="review-kpi">Matched KPI</Label>
        <Choice
          id="review-kpi"
          value={kpiId}
          onChange={setKpiId}
          items={review.kpis.map((k) => ({ value: k.id, label: k.name }))}
          placeholder="— Choose a KPI —"
          disabled={pending}
        />
        {kpi && <p className="text-xs text-muted-foreground">{kpi.processName} · target {kpi.target || "—"}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="review-value">Result</Label>
          <Input
            id="review-value"
            type="number"
            inputMode="decimal"
            step="any"
            value={notMeasured ? "" : value}
            placeholder={notMeasured ? "N/A" : ""}
            disabled={notMeasured || pending}
            onChange={(e) => setValue(e.target.value)}
            className="bg-white dark:bg-slate-950 font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="review-unit">Unit</Label>
          <Choice
            id="review-unit"
            value={unitValue}
            onChange={setUnit}
            items={units.map((u) => ({ value: u.key, label: u.label }))}
            placeholder="Unit"
            disabled={notMeasured || pending}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
        <input
          type="checkbox"
          data-slot="checkbox"
          className="h-4 w-4 accent-blue-600"
          checked={notMeasured}
          disabled={pending}
          onChange={(e) => setNotMeasured(e.target.checked)}
        />
        Not measured this quarter (N/A)
      </label>

      <div className="flex gap-2">
        <Button className="flex-1" onClick={save} disabled={pending || !kpiId}>
          {pending ? "Saving…" : primary}
        </Button>
        {row.status !== "excluded" && (
          <Button variant="outline" onClick={exclude} disabled={pending}>
            Exclude row
          </Button>
        )}
      </div>
    </aside>
  )
}
