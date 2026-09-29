import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { asPercent, bandMeasuredPercent, type Band } from "@/features/dashboard/heatmap"
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

/** "<b>X of N</b> rest", the caption's lead. */
function Of({ n, of, children }: { n: number; of: number; children: React.ReactNode }) {
  return (
    <span>
      <b>
        {n} of {of}
      </b>{" "}
      {children}
    </span>
  )
}

const NOTHING_SET_UP = <span>Nothing set up</span>

/**
 * A percentage section — KPIs and objectives share every state.
 *
 * No colour without evidence:
 *  - nothing to report on        "—", "Nothing set up"
 *  - nothing entered yet         "—", an empty track, "0 of N entered"
 *  - part entered, quarter open  the figure, a neutral bar, "X of N entered"
 *  - everything entered as N/A   "N/A": not measured is not zero
 * A closed quarter is final, so a part-entered one still colours on what
 * it has, and says how much that is.
 */
function PercentSection({
  label,
  meta,
  sub,
  due,
  entered,
  average,
  periodOpen,
  lead,
  rest,
}: {
  label: string
  meta: string
  sub: string
  due: number
  entered: number
  average: number | null
  periodOpen: boolean
  lead: React.ReactNode
  rest: React.ReactNode
}) {
  if (due === 0) {
    return (
      <Section label={label} meta={meta} figure="—" sub="" bar={null} caption={NOTHING_SET_UP} />
    )
  }

  if (entered === 0) {
    return (
      <Section
        label={label}
        meta={meta}
        figure="—"
        sub="not entered yet"
        bar={null}
        caption={<Of n={0} of={due}>entered</Of>}
      />
    )
  }

  const pct = asPercent(average)
  const band = bandMeasuredPercent(pct, entered, due, periodOpen)

  return (
    <Section
      label={label}
      meta={meta}
      figure={pct === null ? "N/A" : `${pct}%`}
      sub={pct === null ? "not measured" : sub}
      bar={pct !== null && <FillBar pct={pct} band={band} />}
      caption={
        <>
          {lead}
          {rest}
          {entered < due && (
            <Muted>
              {entered} of {due} entered
            </Muted>
          )}
        </>
      }
    />
  )
}

function KpiSection({
  kpis,
  periodOpen,
}: {
  kpis: QuarterKpiCounts | undefined
  periodOpen: boolean
}) {
  const due = kpis?.total ?? 0
  const onTarget = kpis?.achieved ?? 0
  const below = kpis?.deviated ?? 0
  // Not measured is an answer, so it counts as entered; only pending is not.
  const entered = due - (kpis?.pending ?? 0)

  return (
    <PercentSection
      label="KPIs"
      meta={`${due} tracked`}
      sub="average achievement"
      due={due}
      entered={entered}
      average={kpis?.averageRatio ?? null}
      periodOpen={periodOpen}
      lead={<Of n={onTarget} of={due}>on target</Of>}
      rest={<Muted>{below} below</Muted>}
    />
  )
}

function ObjectiveSection({
  objectives,
  periodOpen,
}: {
  objectives: QuarterObjectiveCounts | undefined
  periodOpen: boolean
}) {
  const due = objectives?.due ?? 0
  const achieved = objectives?.fullyAchieved ?? 0
  const inProgress = (objectives?.scored ?? 0) - achieved

  return (
    <PercentSection
      label="Objectives"
      meta={`${due} this year`}
      sub="average progress"
      due={due}
      entered={objectives?.entered ?? 0}
      average={objectives?.averageAchievement ?? null}
      periodOpen={periodOpen}
      lead={<Of n={achieved} of={due}>achieved</Of>}
      rest={<Muted>{inProgress} in progress</Muted>}
    />
  )
}

/**
 * Risks have no "entered", they have "reassessed". Critical is only a
 * verdict once every active risk was looked at this quarter, open or
 * closed: until then the bar is neutral and the figure carries no colour.
 */
function RiskSection({ risks, quarter }: { risks: RiskListItem[]; quarter: string }) {
  // The tracker's rule for "active": anything not retired. A closed risk
  // still carries a score worth re-checking each quarter.
  const active = risks.filter((r) => r.status !== "Retired")
  const count: Record<ScoredRiskBand, number> = { critical: 0, medium: 0, low: 0 }
  for (const r of active) {
    const band = riskBand(r.riskScore)
    if (band !== "not_assessed") count[band]++
  }
  const reassessed = count.critical + count.medium + count.low
  const meta = `${active.length} active`

  if (active.length === 0) {
    return (
      <Section label="Active risks" meta={meta} figure="—" sub="" bar={null} caption={NOTHING_SET_UP} />
    )
  }

  if (reassessed === 0) {
    return (
      <Section
        label="Active risks"
        meta={meta}
        figure="—"
        sub="not reassessed yet"
        bar={null}
        caption={
          <Of n={0} of={active.length}>
            reassessed for {quarter}
          </Of>
        }
      />
    )
  }

  const complete = reassessed === active.length

  return (
    <Section
      label="Active risks"
      meta={meta}
      figure={String(count.critical)}
      figureClassName={complete && count.critical > 0 ? "text-status-bad" : undefined}
      sub="critical"
      bar={
        <StackBar
          of={active.length}
          segments={RISK_BANDS.map((b) => ({
            key: b,
            count: count[b],
            band: complete ? RISK_FILL[b] : "neutral",
          }))}
        />
      }
      caption={
        complete ? (
          RISK_BANDS.map((b) => (
            <span key={b} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-[2px]", FILL[RISK_FILL[b]])} aria-hidden />
              {count[b]} {RISK_BAND_LABEL[b]}
            </span>
          ))
        ) : (
          <Of n={reassessed} of={active.length}>
            reassessed
          </Of>
        )
      }
    />
  )
}

/**
 * The dashboard's first row: KPIs, objectives and risks for the selected
 * quarter, led by how they performed rather than how many there are.
 */
export function SummaryStrip({
  quarter,
  periodOpen,
  kpis,
  objectives,
  risks,
}: {
  quarter: string
  /** The selected quarter still accepts figures; part-entered scores stay neutral. */
  periodOpen: boolean
  kpis: QuarterKpiCounts | undefined
  objectives: QuarterObjectiveCounts | undefined
  risks: RiskListItem[]
}) {
  return (
    <Card className="gap-0 py-6 md:flex-row">
      <KpiSection kpis={kpis} periodOpen={periodOpen} />
      <ObjectiveSection objectives={objectives} periodOpen={periodOpen} />
      <RiskSection risks={risks} quarter={quarter} />
    </Card>
  )
}
