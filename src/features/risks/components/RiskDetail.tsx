import Link from "next/link"
import { ArrowLeft, Layers, ShieldAlert, History, Wrench } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Enums } from "@/types/database"
import type { RiskStatus } from "@/components/forms/RiskForm"
import type {
  RiskDetail as RiskDetailData,
  RiskScore,
  RiskTreatment,
} from "@/features/risks/queries"
import { riskBand, RISK_BAND_LABEL } from "@/features/risks/scoring"
import { PILL, SCORE, RISK_SCORE, RISK_STATUS, TREATMENT_STATUS } from "@/components/shared/status-styles"

// Thresholds live in features/risks/scoring.ts; presentation in
// components/shared/status-styles.ts — the same square and pills as the
// register, so the detail page and the list agree about every risk.
function ScoreBadge({ score }: { score: number | null }) {
  const band = riskBand(score)
  return (
    <span className={`${SCORE} ${RISK_SCORE[band]}`} title={RISK_BAND_LABEL[band]}>
      {score === null ? "—" : score}
    </span>
  )
}

function StatusBadge({ status }: { status: RiskStatus }) {
  return <span className={`${PILL} ${RISK_STATUS[status]}`}>{status}</span>
}

const TREATMENT_STATUS_LABEL: Record<Enums<"treatment_status">, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
}

function TreatmentStatusBadge({ status }: { status: Enums<"treatment_status"> }) {
  return (
    <span className={`${PILL} ${TREATMENT_STATUS[status]}`}>{TREATMENT_STATUS_LABEL[status]}</span>
  )
}

// The review's verdict on the treatment, as the report's column reads.
const EFFECTIVENESS: Record<Enums<"treatment_effectiveness">, string> = {
  maintain: "Maintain",
  correction: "Correction",
  corrective_action: "Corrective action",
}

// Fixed locale and zone: rendered on the server, and a report date should not
// move with whichever machine happens to render it.
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  })

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-slate-100 whitespace-pre-line">{children ?? "—"}</dd>
    </div>
  )
}

function SectionHeader({
  icon,
  tone,
  title,
  description,
}: {
  icon: React.ReactNode
  tone: string
  title: string
  description: string
}) {
  return (
    <div className="flex items-center gap-2">
      <div className={`p-1.5 rounded-lg ${tone}`}>{icon}</div>
      <div>
        <h2 className="text-sm font-bold tracking-tight">{title}</h2>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

/**
 * Read-only risk definition, assessment history and treatment plan. Nothing
 * here writes; residual ratings are recorded from the register.
 */
export default function RiskDetail({
  risk,
  backHref,
}: {
  risk: RiskDetailData
  /** Register page with the period the user came from, so Back returns there. */
  backHref: string
}) {
  // Same rule as the register's title column: the statement when the form
  // has one, else the threat, else the assets.
  const title = risk.riskStatement ?? risk.threat ?? risk.affectedAssets
  // The current score is the most recent residual rating, whatever period it
  // is in — this page is not period-scoped.
  const current = risk.residuals.at(-1) ?? null

  return (
    <div className="flex-1 p-4 md:p-6 w-full max-w-[1440px] mx-auto space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Link
          href={backHref}
          className={`${buttonVariants({ variant: "ghost", size: "icon" })} shrink-0 mt-0.5`}
          aria-label="Back to risks"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs font-medium text-slate-500 bg-slate-50 dark:bg-slate-900">
              <Layers className="h-3 w-3 mr-1" />
              {risk.processName}
            </Badge>
            {risk.department && (
              <Badge variant="outline" className="text-[11px] font-medium text-slate-500 bg-slate-50 dark:bg-slate-900" title={risk.department.name}>
                {risk.department.code}
              </Badge>
            )}
            <StatusBadge status={risk.status} />
            <ScoreBadge score={current?.rpn ?? null} />
          </div>
          <h1 className="text-lg md:text-xl font-semibold leading-snug tracking-tight text-slate-900 dark:text-slate-100 max-w-[75ch]">
            {title}
          </h1>
          {risk.referenceNumber !== null && (
            <p className="text-sm text-muted-foreground mt-1">
              Ref {risk.referenceNumber} · {risk.processName}
            </p>
          )}
        </div>
      </div>

      {/* ── Definition ── */}
      <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-5 md:p-6 shadow-sm space-y-5">
        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
          <SectionHeader
            icon={<ShieldAlert className="h-4 w-4" />}
            tone="bg-slate-100 text-ink-2"
            title="Definition"
            description="The risk as written on the register."
          />
        </div>

        {/* threat / vulnerability / risk_statement are null on every SRD risk
            because their form has no such columns. A null field is absent from
            the grid, not rendered as an empty box — the form didn't ask. */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-5">
          <div className="sm:col-span-2 lg:col-span-3">
            <Field label="Affected assets">{risk.affectedAssets}</Field>
          </div>
          {risk.threat !== null && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Threat">{risk.threat}</Field>
            </div>
          )}
          {risk.vulnerability !== null && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Vulnerability">{risk.vulnerability}</Field>
            </div>
          )}
          {risk.riskStatement !== null && (
            <div className="sm:col-span-2 lg:col-span-3">
              <Field label="Risk statement">{risk.riskStatement}</Field>
            </div>
          )}
          <Field label="Risk owner">{risk.riskOwnerTitle}</Field>
          <Field label="Reference">{risk.referenceNumber}</Field>
          <Field label="Created">{fmtDate(risk.createdAt)}</Field>
        </dl>
      </section>

      {/* ── Assessment history ── */}
      <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 md:px-6 border-b border-slate-200 dark:border-slate-800">
          <SectionHeader
            icon={<History className="h-4 w-4" />}
            tone="bg-slate-100 text-ink-2"
            title="Assessment history"
            description="The pre-treatment baseline, then one residual rating per period. Score is severity × likelihood."
          />
        </div>

        {risk.baseline === null && risk.residuals.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No assessments have been recorded for this risk.</p>
        ) : (
          <Table>
            <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
              <TableRow>
                <TableHead className="h-10 pl-6">Period</TableHead>
                <TableHead className="h-10 text-center">Severity</TableHead>
                <TableHead className="h-10 text-center">Likelihood</TableHead>
                <TableHead className="h-10">Score</TableHead>
                <TableHead className="h-10">Notes</TableHead>
                <TableHead className="h-10 pr-6">Assessed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* The baseline has no reporting period by design — it is the
                  rating before any treatment, not a quarter's reading. */}
              {risk.baseline && (
                <AssessmentRow
                  score={risk.baseline}
                  period={
                    <span className="flex flex-col">
                      <span>Baseline</span>
                      <span className="text-[11px] font-normal text-muted-foreground">pre-treatment</span>
                    </span>
                  }
                  className="bg-slate-50/60 dark:bg-slate-900/30"
                />
              )}
              {risk.residuals.map((row) => (
                <AssessmentRow key={row.id} score={row} period={row.period} />
              ))}
            </TableBody>
          </Table>
        )}
      </section>

      {/* ── Treatment ── */}
      <section className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 md:px-6 border-b border-slate-200 dark:border-slate-800">
          <SectionHeader
            icon={<Wrench className="h-4 w-4" />}
            tone="bg-slate-100 text-ink-2"
            title="Treatment"
            description="The planned response and how each period's review judged it."
          />
        </div>

        {risk.treatments.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No treatment has been recorded for this risk.</p>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {risk.treatments.map((t) => (
              <TreatmentBlock key={t.id} treatment={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function AssessmentRow({
  score,
  period,
  className,
}: {
  score: RiskScore
  period: React.ReactNode
  className?: string
}) {
  return (
    <TableRow className={className}>
      <TableCell className="pl-6 font-medium whitespace-nowrap">{period}</TableCell>
      <TableCell className="text-center tabular-nums">{score.severity}</TableCell>
      <TableCell className="text-center tabular-nums">{score.likelihood}</TableCell>
      <TableCell><ScoreBadge score={score.rpn} /></TableCell>
      <TableCell className="text-sm text-muted-foreground max-w-[280px] whitespace-normal" title={score.notes ?? undefined}>
        <span className="line-clamp-2">{score.notes || "—"}</span>
      </TableCell>
      <TableCell className="pr-6 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(score.assessedAt)}</TableCell>
    </TableRow>
  )
}

function TreatmentBlock({ treatment: t }: { treatment: RiskTreatment }) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5 p-5 md:p-6">
        <div className="sm:col-span-2 lg:col-span-4">
          <Field label="Treatment solution">{t.solution}</Field>
        </div>
        {t.monitoringEvidence !== null && (
          <div className="sm:col-span-2 lg:col-span-4">
            <Field label="Monitoring evidence">{t.monitoringEvidence}</Field>
          </div>
        )}
        <Field label="Status"><TreatmentStatusBadge status={t.status} /></Field>
        <Field label="Owner">{t.ownerTitle}</Field>
        <Field label="Start">{t.startDate ? fmtDate(t.startDate) : null}</Field>
        <Field label="Target">{t.targetDate ? fmtDate(t.targetDate) : null}</Field>
        {t.completedDate && (
          <Field label="Completed">{fmtDate(t.completedDate)}</Field>
        )}
      </dl>

      {t.reviews.length === 0 ? (
        <p className="px-5 md:px-6 pb-6 text-sm text-muted-foreground">No reviews have been recorded for this treatment.</p>
      ) : (
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Period</TableHead>
              <TableHead className="h-10">Effectiveness</TableHead>
              <TableHead className="h-10">Solution evidence</TableHead>
              <TableHead className="h-10">Reason for deviation</TableHead>
              <TableHead className="h-10">Follow-up measure</TableHead>
              <TableHead className="h-10 pr-6">Reviewed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {t.reviews.map((r) => (
              <TableRow key={r.id} className="align-top">
                <TableCell className="pl-6 font-medium whitespace-nowrap">{r.period}</TableCell>
                <TableCell className="whitespace-nowrap">
                  {r.effectiveness ? (
                    <Badge variant="outline" className="font-medium">{EFFECTIVENESS[r.effectiveness]}</Badge>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[220px] whitespace-normal">
                  {r.solutionEvidence || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[320px] whitespace-normal">
                  {r.reasonForDeviation || "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[320px] whitespace-normal">
                  {r.followupMeasure || "—"}
                </TableCell>
                <TableCell className="pr-6 text-sm text-muted-foreground whitespace-nowrap">{fmtDate(r.reviewedAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )
}
