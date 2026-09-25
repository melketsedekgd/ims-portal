"use client"

import { useId, useState } from "react"
import { ChevronDown } from "lucide-react"
import type { RiskListItem } from "@/features/risks/queries"
import { riskBand, RISK_BAND_LABEL, type RiskBand, type ScoredRiskBand } from "@/features/risks/scoring"
import { PILL, RISK_BAND_PILL, RISK_MAP_CELL, RISK_MAP_SWATCH } from "@/components/shared/status-styles"

/** One square of the map: a likelihood and a severity, each 1–5. */
export type HeatCell = { likelihood: number; severity: number }

/**
 * ?ls=L-S, e.g. "3-5". Anything else — out of range, a stray character,
 * absent — is no selection, never an error: the URL is hand-editable.
 */
export function parseHeatCell(value: string | null): HeatCell | null {
  const m = /^([1-5])-([1-5])$/.exec(value ?? "")
  return m ? { likelihood: Number(m[1]), severity: Number(m[2]) } : null
}

export const heatCellParam = (cell: HeatCell) => `${cell.likelihood}-${cell.severity}`

export const inHeatCell = (row: RiskListItem, cell: HeatCell) =>
  row.likelihood === cell.likelihood && row.severity === cell.severity

const SCALE = [1, 2, 3, 4, 5] as const
// Severity runs up the page: 5 on the top row.
const SEVERITY_ROWS = [5, 4, 3, 2, 1] as const

const CHIP_BANDS: RiskBand[] = ["critical", "medium", "low", "not_assessed"]

const LEGEND: { band: ScoredRiskBand; text: string }[] = [
  { band: "low", text: "Low · score 1–4" },
  { band: "medium", text: "Medium · score 5–14" },
  { band: "critical", text: "Critical · score 15–25" },
]

const AXIS = "text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-400"
const TICK = "text-xs text-slate-600 dark:text-slate-400 text-center tabular-nums"

const plural = (n: number) => `${n} ${n === 1 ? "risk" : "risks"}`

/**
 * Where the period's risks sit by residual likelihood × severity.
 *
 * Built from the same rows the table renders — no query of its own — so
 * the two cannot disagree. Counts are always over the full list: `selected`
 * dims the other squares but never changes a number, the same rule the
 * band chips follow. A risk with no residual rating for the period has no
 * square; it is counted in "Not assessed" and nowhere on the grid.
 *
 * Colour is the band of the square's own L × S, taken from riskBand(), so
 * the thresholds stay in scoring.ts.
 *
 * Hiding the map is this component's own state, deliberately not saved:
 * it only folds the grid away. It leaves `selected` alone — the table's
 * filter chip still says what is hidden and still clears it.
 */
export default function RiskHeatMap({
  risks,
  showDept,
  selected,
  onSelect,
}: {
  risks: RiskListItem[]
  /** The list spans departments: each square says whose risks it holds. */
  showDept: boolean
  selected: HeatCell | null
  /** null clears the selection. */
  onSelect: (cell: HeatCell | null) => void
}) {
  const [open, setOpen] = useState(true)
  const bodyId = useId()
  const bandCounts = new Map<RiskBand, number>()
  const cells = new Map<string, RiskListItem[]>()
  for (const r of risks) {
    const band = riskBand(r.riskScore)
    bandCounts.set(band, (bandCounts.get(band) ?? 0) + 1)
    if (r.likelihood === null || r.severity === null) continue
    const key = `${r.likelihood}-${r.severity}`
    cells.set(key, [...(cells.get(key) ?? []), r])
  }

  return (
    <section
      aria-labelledby="risk-map-title"
      className="min-w-0 rounded-md border bg-white dark:bg-slate-950 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 min-h-[52px]">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="risk-map-title" className="text-sm font-semibold text-ink dark:text-slate-100 mr-1">
            Risk map
          </h2>
          {CHIP_BANDS.map((band) => (
            <span key={band} className={`${PILL} ${RISK_BAND_PILL[band]}`}>
              <span className="tabular-nums">{bandCounts.get(band) ?? 0}</span> {RISK_BAND_LABEL[band]}
            </span>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={() => setOpen((o) => !o)}
          className="-mr-2 flex h-11 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-ink hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800"
        >
          {open ? "Hide map" : "Show map"}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      {/* Phones: the grid keeps its 620px and scrolls inside its own box,
          so the page never scrolls sideways; the legend drops under it.
          The box's 4px padding keeps focus rings from being clipped. */}
      {open && (
        <div id={bodyId} className="flex flex-col gap-4 px-4 py-4 md:flex-row md:flex-wrap md:gap-8 md:px-5">
          <div className="-m-1 min-w-0 max-w-[calc(100%+0.5rem)] overflow-x-auto p-1">
            <div className="flex w-max gap-4 md:gap-8">
              <div className="flex items-center">
                <span className={`${AXIS} [writing-mode:vertical-rl] rotate-180`}>SEVERITY →</span>
              </div>

              <div className="w-[620px] shrink-0 flex flex-col gap-1">
                {SEVERITY_ROWS.map((severity) => (
                  <div key={severity} className="grid grid-cols-[18px_repeat(5,1fr)] gap-1 items-center">
                    <span className={TICK}>{severity}</span>
                    {SCALE.map((likelihood) => {
                      const here = cells.get(`${likelihood}-${severity}`) ?? []
                      const colours = RISK_MAP_CELL[riskBand(likelihood * severity) as ScoredRiskBand]
                      const isSelected =
                        selected?.likelihood === likelihood && selected?.severity === severity
                      const dimmed = selected !== null && !isSelected
                      return (
                        <button
                          key={likelihood}
                          type="button"
                          // Empty squares are not clickable — unless selected: a
                          // square emptied by a re-rating since, or a hand-typed
                          // ?ls, must still be possible to un-press.
                          disabled={here.length === 0 && !isSelected}
                          aria-pressed={isSelected}
                          aria-label={`Likelihood ${likelihood}, severity ${severity}: ${plural(here.length)}`}
                          onClick={() => onSelect(isSelected ? null : { likelihood, severity })}
                          className={[
                            "flex h-11 flex-col items-center justify-center rounded-md leading-none transition-opacity",
                            here.length > 0 ? `${colours.filled} cursor-pointer` : `${colours.empty} cursor-default`,
                            isSelected ? "border-[3px] border-[#0f172a]" : "border border-slate-900/10",
                            dimmed ? "opacity-[0.55]" : "",
                          ].join(" ")}
                        >
                          {here.length > 0 && (
                            <>
                              <span className="text-[17px] font-bold tabular-nums">{here.length}</span>
                              {showDept && (
                                <span className="mt-0.5 text-[11px] font-semibold tabular-nums">
                                  {byDepartment(here)}
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      )
                    })}
                  </div>
                ))}
                <div className="grid grid-cols-[18px_repeat(5,1fr)] gap-1 pt-0.5">
                  <span />
                  {SCALE.map((l) => (
                    <span key={l} className={TICK}>{l}</span>
                  ))}
                </div>
                <span className={`${AXIS} pl-[22px] text-center`}>LIKELIHOOD →</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 text-[13px] text-slate-700 dark:border-slate-800 dark:text-slate-300 md:min-w-[200px] md:max-w-[320px] md:grow md:border-t-0 md:border-l md:pl-6 md:pt-1">
            {LEGEND.map(({ band, text }) => (
              <span key={band} className="flex items-center gap-2">
                <span className={`h-3.5 w-3.5 rounded ${RISK_MAP_SWATCH[band]}`} aria-hidden />
                {text}
              </span>
            ))}
            <p className="border-t border-slate-100 dark:border-slate-800 pt-2 text-slate-600 dark:text-slate-400">
              Click a square to show only those risks in the table below.
            </p>
          </div>
        </div>
      )}
    </section>
  )
}

/** "IT 1 · SRD 2", departments in code order. */
function byDepartment(risks: RiskListItem[]): string {
  const counts = new Map<string, number>()
  for (const r of risks) counts.set(r.departmentCode, (counts.get(r.departmentCode) ?? 0) + 1)
  return [...counts]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([code, n]) => `${code} ${n}`)
    .join(" · ")
}
