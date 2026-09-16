import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { riskBand, RISK_BAND_LABEL, type RiskBand } from "@/features/risks/scoring"
import {
  PILL,
  KPI_STATUS,
  OBJECTIVE_OUTCOME,
  RISK_BAND_PILL,
} from "@/components/shared/status-styles"
import type { QuarterKpiCounts } from "@/features/kpis/queries"
import type { QuarterObjectiveCounts } from "@/features/objectives/queries"
import type { RiskListItem } from "@/features/risks/queries"

// Same pill as the tables, so a chip here and a cell there read as the same
// status. Pending is the dashed outline and Not Measured the filled grey,
// on the dashboard as in the list.
function Chip({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <span className={`${PILL} ${tone}`}>
      <span className="tabular-nums font-semibold">{value}</span>
      {label}
    </span>
  )
}

// A quarter with no reporting_periods row has no counts at all, which is not
// the same as a quarter whose counts are zero.
function NoPeriod() {
  return (
    <p className="text-xs text-muted-foreground">
      No reporting period exists for this quarter.
    </p>
  )
}

function Total({ children }: { children: React.ReactNode }) {
  return <div className="text-3xl font-semibold tabular-nums text-foreground">{children}</div>
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <CardFooter className="pt-2 border-t text-xs">
      <Link href={href} className="flex items-center gap-1.5 font-medium text-primary hover:underline">
        {children}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </CardFooter>
  )
}

/**
 * The period's counts. The cards are not clickable — only the footer link
 * is — so they carry no hover treatment.
 */
export function OverviewCards({
  kpis,
  objectives,
  risks,
}: {
  kpis: QuarterKpiCounts | undefined
  objectives: QuarterObjectiveCounts | undefined
  risks: RiskListItem[]
}) {
  // Banded through riskBand so an unscored risk lands in not_assessed. A
  // `riskScore < 5` test would put it in Low, because null < 5 is true.
  const riskCounts: Record<RiskBand, number> = {
    critical: 0,
    medium: 0,
    low: 0,
    not_assessed: 0,
  }
  for (const r of risks) riskCounts[riskBand(r.riskScore)]++

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {/* ── 1. Objectives ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Objectives</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Total>{objectives ? objectives.total : "—"}</Total>
          {objectives ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip value={objectives.measured} label="measured" tone={OBJECTIVE_OUTCOME.measured} />
              <Chip value={objectives.notReported} label="not reported" tone={OBJECTIVE_OUTCOME.not_reported} />
              <Chip value={objectives.completedEarlier} label="completed earlier" tone={OBJECTIVE_OUTCOME.completed_earlier} />
              <Chip value={objectives.notMeasured} label="N/A" tone={OBJECTIVE_OUTCOME.not_measured} />
            </div>
          ) : (
            <NoPeriod />
          )}
        </CardContent>
        <FooterLink href="/department/objectives">View all objectives</FooterLink>
      </Card>

      {/* ── 2. KPIs ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">KPIs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* A count, not a rate. Any percentage needs a denominator, and both
              choices misstate a quarter nobody has measured yet. */}
          <Total>{kpis ? kpis.total : "—"}</Total>
          {kpis ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <Chip value={kpis.achieved} label="achieved" tone={KPI_STATUS.Achieved} />
              <Chip value={kpis.deviated} label="deviated" tone={KPI_STATUS.Deviated} />
              <Chip value={kpis.pending} label="pending" tone={KPI_STATUS.Pending} />
              <Chip value={kpis.notMeasured} label="N/A" tone={KPI_STATUS["Not Measured"]} />
            </div>
          ) : (
            <NoPeriod />
          )}
        </CardContent>
        <FooterLink href="/department/kpis">View all KPIs</FooterLink>
      </Card>

      {/* ── 3. Risks ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Risks</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Total>{risks.length}</Total>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["critical", "medium", "low", "not_assessed"] as const).map((band) => (
              <Chip
                key={band}
                value={riskCounts[band]}
                label={RISK_BAND_LABEL[band]}
                tone={RISK_BAND_PILL[band]}
              />
            ))}
          </div>
        </CardContent>
        <FooterLink href="/department/risks">View all risks</FooterLink>
      </Card>
    </div>
  )
}
