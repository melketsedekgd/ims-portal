import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { asPercent, bandPercent, type Band } from "@/features/dashboard/heatmap"
import { riskBand, RISK_BAND_LABEL, type ScoredRiskBand } from "@/features/risks/scoring"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"
import type { RiskListItem } from "@/features/risks/queries"

/** Bar and legend fills. Status tokens only; neutral is ink at 30%. */
const FILL: Record<Band, string> = {
  good: "bg-status-good",
  warn: "bg-status-warn",
  bad: "bg-status-bad",
  neutral: "bg-status-neutral",
}

const RISK_FILL: Record<ScoredRiskBand, Band> = {
  critical: "bad",
  medium: "warn",
  low: "good",
}

const RISK_BANDS: ScoredRiskBand[] = ["critical", "medium", "low"]

type Segment = { key: string; count: number; band: Band }

/**
 * Presentation only: every figure, bar and caption arrives computed from the
 * sections below. Colour appears in the bars and the risk figure, nowhere
 * else.
 */
function Section({
  label,
  meta,
  figure,
  figureClassName,
  sub,
  bar,
  caption,
}: {
  label: string
  meta: string
  figure: string
  figureClassName?: string
  sub: string
  bar: React.ReactNode
  caption: React.ReactNode
}) {
  return (
    <section
      aria-label={label}
      className="flex min-w-0 flex-1 basis-0 flex-col gap-3 border-ink/8 px-7 py-5 first:pt-0 last:pb-0 not-first:border-t md:py-0 md:not-first:border-t-0 md:not-first:border-l"
    >
      <div className="flex items-center justify-between gap-3 text-xs text-ink/70">
        <span className="font-bold uppercase tracking-[0.08em]">{label}</span>
        <span>{meta}</span>
      </div>
      <div className="flex items-baseline gap-2.5">
        <span
          className={cn(
            "text-[40px] font-extrabold leading-none tracking-[-0.02em] tabular-nums text-ink",
            figureClassName
          )}
        >
          {figure}
        </span>
        <span className="text-sm text-ink/70">{sub}</span>
      </div>
      <div className="flex h-[7px] gap-[2px] overflow-hidden rounded-full bg-status-pending">
        {bar}
      </div>
      <div className="flex flex-wrap gap-x-3.5 gap-y-1 text-sm text-ink">{caption}</div>
    </section>
  )
}

/** A single fill, 0–100. Overrides can push a ratio past 1; the bar stops at full. */
function FillBar({ pct, band }: { pct: number; band: Band }) {
  return (
    <div
      className={cn("h-full rounded-full", FILL[band])}
      style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
    />
  )
}

/**
 * Stacked segments, each as wide as its share of `of`. flex-grow rather than
 * percentage widths so the 2px gaps come out of the segments, not past the
 * track's end.
 */
function StackBar({ segments, of }: { segments: Segment[]; of: number }) {
  const shown = segments.filter((s) => s.count > 0)
  const rest = of - shown.reduce((n, s) => n + s.count, 0)
  return (
    <>
      {shown.map((s) => (
        <div key={s.key} className={cn("h-full", FILL[s.band])} style={{ flexGrow: s.count }} />
      ))}
      {rest > 0 && <div className="h-full" style={{ flexGrow: rest }} />}
    </>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-ink/70">{children}</span>
}

function KpiSection({ kpis }: { kpis: QuarterKpiCounts | undefined }) {
  const total = kpis?.total ?? 0
  const onTarget = kpis?.achieved ?? 0
  const below = kpis?.deviated ?? 0
  const pct = asPercent(kpis?.averageRatio ?? null)

  return (
    <Section
      label="KPIs"
      meta={`${total} tracked`}
      figure={pct === null ? "—" : `${pct}%`}
      sub="average achievement"
      bar={pct !== null && <FillBar pct={pct} band={bandPercent(pct)} />}
      caption={
        <>
          <span>
            <b>
              {onTarget} of {total}
            </b>{" "}
            on target
          </span>
          <Muted>{below} below</Muted>
        </>
      }
    />
  )
}

function ObjectiveSection({ objectives }: { objectives: QuarterObjectiveCounts | undefined }) {
  const due = objectives?.due ?? 0
  const achieved = objectives?.fullyAchieved ?? 0
  const inProgress = (objectives?.scored ?? 0) - achieved
  const pct = asPercent(objectives?.averageAchievement ?? null)

  return (
    <Section
      label="Objectives"
      meta={`${due} this year`}
      figure={pct === null ? "—" : `${pct}%`}
      sub="average progress"
      bar={pct !== null && <FillBar pct={pct} band={bandPercent(pct)} />}
      caption={
        <>
          <span>
            <b>
              {achieved} of {due}
            </b>{" "}
            achieved
          </span>
          <Muted>{inProgress} in progress</Muted>
        </>
      }
    />
  )
}

function RiskSection({ risks }: { risks: RiskListItem[] }) {
  // The tracker's rule for "active": anything not retired. A closed risk
  // still carries a score worth re-checking each quarter.
  const active = risks.filter((r) => r.status !== "Retired")
  const count: Record<ScoredRiskBand, number> = { critical: 0, medium: 0, low: 0 }
  for (const r of active) {
    const band = riskBand(r.riskScore)
    if (band !== "not_assessed") count[band]++
  }

  return (
    <Section
      label="Active risks"
      meta={`${active.length} active`}
      figure={String(count.critical)}
      figureClassName={count.critical > 0 ? "text-status-bad" : undefined}
      sub="critical"
      bar={
        <StackBar
          of={active.length}
          segments={RISK_BANDS.map((b) => ({ key: b, count: count[b], band: RISK_FILL[b] }))}
        />
      }
      caption={RISK_BANDS.map((b) => (
        <span key={b} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2 rounded-[2px]", FILL[RISK_FILL[b]])} aria-hidden />
          {count[b]} {RISK_BAND_LABEL[b]}
        </span>
      ))}
    />
  )
}

/**
 * The dashboard's first row: KPIs, objectives and risks for the selected
 * quarter, led by how they performed rather than how many there are.
 */
export function SummaryStrip({
  kpis,
  objectives,
  risks,
}: {
  kpis: QuarterKpiCounts | undefined
  objectives: QuarterObjectiveCounts | undefined
  risks: RiskListItem[]
}) {
  return (
    <Card className="gap-0 py-6 md:flex-row">
      <KpiSection kpis={kpis} />
      <ObjectiveSection objectives={objectives} />
      <RiskSection risks={risks} />
    </Card>
  )
}
