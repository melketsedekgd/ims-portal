import PageHeader from "@/components/shared/PageHeader"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PILL, SIGNOFF_STATUS, SIGNOFF_STATUS_LABEL } from "@/components/shared/status-styles"
import { getCurrentUser } from "@/features/auth/queries"
import { isAdmin, managedDepartmentIds } from "@/lib/permissions"
import {
  getSignoffDetail,
  getSignoffKpis,
  getSignoffObjectives,
  getSignoffRisks,
  getSignoffDecisions,
} from "@/features/signoff/queries"
import DecisionActions from "@/features/signoff/components/DecisionActions"

const DECISION_VERB: Record<string, string> = {
  submit: "submitted",
  return: "returned",
  approve: "approved",
  receive: "received",
}

function stamp(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function percent(value: number | null): string {
  if (value === null) return "—"
  return `${Math.round(value * 100)}%`
}

export default async function SignOffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const detail = await getSignoffDetail(id)

  // RLS hides another department's sign-off exactly as it hides one that does
  // not exist, so there is no way to tell the two apart — and no reason to.
  if (!detail) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Sign-off</h1>
        <p className="text-sm text-muted-foreground">This sign-off isn&rsquo;t visible to you.</p>
      </div>
    )
  }

  const [user, kpis, objectives, risks, decisions] = await Promise.all([
    getCurrentUser(),
    getSignoffKpis(detail.departmentId, detail.periodId),
    getSignoffObjectives(detail.departmentId, detail.periodId),
    getSignoffRisks(detail.departmentId, detail.periodId),
    getSignoffDecisions(detail.id),
  ])

  const manages = managedDepartmentIds(user).includes(detail.departmentId)
  const contributes = (user?.roles ?? []).some(
    (r) =>
      r.departmentId === detail.departmentId &&
      (r.key === "department_contributor" || r.key === "department_manager")
  )
  const samePerson =
    detail.submittedById !== null && detail.submittedById === detail.approvedById

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${detail.departmentName} — ${detail.periodLabel} ${detail.periodYear}`}
        description="What this department is signing for: the figures as they stood when the quarter was submitted."
        beside={
          <Badge className={`${PILL} ${SIGNOFF_STATUS[detail.status]}`}>
            {SIGNOFF_STATUS_LABEL[detail.status]}
          </Badge>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Signature label="Prepared by" name={detail.submittedBy} at={detail.submittedAt} />
        <Signature
          label="Approved by"
          name={detail.approvedBy}
          at={detail.approvedAt}
          note={samePerson ? "Prepared and approved by the same person" : undefined}
        />
        <Signature label="Received by" name={detail.receivedBy} at={detail.receivedAt} />
      </div>

      <DecisionActions
        departmentId={detail.departmentId}
        periodId={detail.periodId}
        status={detail.status}
        canDecide={manages}
        canReceive={isAdmin(user)}
        canResubmit={contributes}
        year={detail.periodYear}
        quarter={detail.periodLabel}
      />

      <Section title={`KPIs (${kpis.length})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>KPI</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Actual</TableHead>
              <TableHead>Achievement</TableHead>
              <TableHead>Remark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {kpis.map((k) => {
              const below = k.ratio !== null && k.ratio < 1
              return (
                <TableRow
                  key={k.id}
                  className={
                    k.notMeasured
                      ? "text-muted-foreground"
                      : below
                        ? "bg-rose-50/50 dark:bg-rose-950/20"
                        : undefined
                  }
                >
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="text-sm">{k.target ?? "—"}</TableCell>
                  <TableCell className="text-sm tabular-nums">{k.actual}</TableCell>
                  <TableCell className="text-sm tabular-nums">{percent(k.ratio)}</TableCell>
                  <TableCell className="text-sm">{k.remark ?? "—"}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Section>

      <Section title={`Objectives (${objectives.length})`}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Objective</TableHead>
              <TableHead>Achievement</TableHead>
              <TableHead>Activities</TableHead>
              <TableHead>Reason for deviation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {objectives.map((o) => (
              <TableRow
                key={o.id}
                className={
                  o.notMeasured
                    ? "text-muted-foreground"
                    : o.reasonForDeviation
                      ? "bg-rose-50/50 dark:bg-rose-950/20"
                      : undefined
                }
              >
                <TableCell className="font-medium max-w-md">
                  <span className="line-clamp-2">{o.title}</span>
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {o.notMeasured ? "Not measured" : percent(o.achievement)}
                </TableCell>
                <TableCell className="text-sm tabular-nums">
                  {o.activitiesTotal !== null
                    ? `${o.activitiesCompleted ?? 0} of ${o.activitiesTotal}`
                    : "—"}
                </TableCell>
                <TableCell className="text-sm">{o.reasonForDeviation ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section
        title={`Risk updates (${risks.length})`}
        description="Shown for context. A risk reassessment is not required to sign the quarter."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead>S</TableHead>
              <TableHead>L</TableHead>
              <TableHead>RPN</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {risks.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="tabular-nums">{r.reference ?? "—"}</TableCell>
                <TableCell className="max-w-md">
                  <span className="line-clamp-2">{r.title}</span>
                </TableCell>
                {r.rpn === null ? (
                  <TableCell colSpan={3} className="text-sm text-muted-foreground">
                    Not reassessed
                  </TableCell>
                ) : (
                  <>
                    <TableCell className="tabular-nums">{r.severity}</TableCell>
                    <TableCell className="tabular-nums">{r.likelihood}</TableCell>
                    <TableCell className="tabular-nums font-medium">{r.rpn}</TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="Decision history">
        <ul className="divide-y divide-slate-200 dark:divide-slate-800">
          {decisions.map((d) => (
            <li key={d.id} className="py-2.5">
              <p className="text-sm text-ink">
                <span className="font-medium">{d.by}</span>{" "}
                {DECISION_VERB[d.decision] ?? d.decision} this quarter
                <span className="text-muted-foreground"> · {stamp(d.at)}</span>
              </p>
              {d.reason && <p className="text-sm text-muted-foreground mt-0.5">{d.reason}</p>}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Signature({
  label,
  name,
  at,
  note,
}: {
  label: string
  name: string | null
  at: string | null
  note?: string
}) {
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-ink mt-1">{name ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{stamp(at)}</p>
      {note && <p className="text-xs text-amber-700 dark:text-amber-500 mt-1.5">{note}</p>}
    </div>
  )
}

function Section({
  title,
  description,
  children,
}: {
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <div>
        <h2 className="text-sm font-medium text-ink">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800">{children}</div>
    </section>
  )
}
