import { createClient } from "@/lib/supabase/server";
import { getQuarterlyPeriods } from "@/features/periods/queries";
import type { Database, Enums } from "@/types/database";
import type { RiskStatus } from "@/components/forms/RiskForm";

/**
 * The list projection for /department/risks.
 *
 * Still separate from RiskFormData after that type was trimmed, for two
 * reasons that are not going away: the form's scores are non-nullable because
 * it always has values to edit, and it carries mitigationStrategy, which comes
 * from risk_treatments — detail-page data this query deliberately does not
 * fetch.
 *
 * likelihood / severity / riskScore are nullable here. A risk with no residual
 * assessment in the selected period has no score, and zero is not the same
 * statement as "unknown".
 */
export type RiskListItem = {
  id: string;
  period: string;
  /** departments.code, for the Dept tag when the list spans departments. */
  departmentCode: string;
  processName: string;
  title: string;
  description: string;
  likelihood: number | null;
  severity: number | null;
  riskScore: number | null;
  status: RiskStatus;
};

type DbRiskStatus = Database["public"]["Enums"]["risk_status"];

type RiskRow = {
  id: string;
  reference_number: number | null;
  affected_assets: string;
  threat: string | null;
  vulnerability: string | null;
  risk_statement: string | null;
  status: DbRiskStatus;
  processes: { name: string; display_order: number | null } | null;
  departments: { code: string } | null;
  risk_assessments: {
    severity: number;
    likelihood: number;
    rpn: number | null;
    assessed_at: string;
  }[];
};

// 'retired' reaches the mapper: a risk retired after Q1 still appears on Q1.
// It maps to its own badge rather than to "Closed" — withdrawn from the
// register and resolved are different claims about a risk.
const STATUS_LABEL: Record<DbRiskStatus, RiskStatus> = {
  open: "Open",
  treated: "Mitigating",
  closed: "Closed",
  retired: "Retired",
};

/**
 * A risk belongs in a period's register if it is still live, or if it was
 * assessed in that period. Retiring a risk in Q2 must not rewrite the Q1
 * report it appeared on.
 *
 * This disjunction is not expressible as a PostgREST filter. `.or()` cannot
 * reference an embedded resource path — `or=(status.neq.retired,
 * risk_assessments.reporting_period_id.eq.X)` is rejected with PGRST100,
 * "failed to parse logic tree", with or without !inner on the embed. So the
 * query fetches every risk the caller can see and the predicate is applied
 * here. `status` is selected for exactly this reason.
 */
function belongsToPeriod(r: RiskRow): boolean {
  return r.status !== "retired" || r.risk_assessments.length > 0;
}

/**
 * risk_assessments is append-only with no unique constraint on
 * (risk_id, type, reporting_period_id), so a period can hold more than one
 * residual row for a risk. The embed order is unspecified, so [0] is not the
 * current score — the newest assessed_at is. No risk currently has more than
 * one; this is defence, not a workaround.
 */
function latestAssessment<T extends { assessed_at: string }>(
  assessments: T[]
): T | undefined {
  return assessments.reduce<T | undefined>(
    (newest, a) =>
      !newest || Date.parse(a.assessed_at) > Date.parse(newest.assessed_at)
        ? a
        : newest,
    undefined
  );
}

// Nulls sort last. Infinity rather than a 9999 sentinel: reference_number is a
// smallint and can legitimately exceed any fixed sentinel.
const order = (n: number | null | undefined) => n ?? Number.POSITIVE_INFINITY;

export async function getRisksForPeriod(
  year: number,
  label: string,
  departmentId?: string
): Promise<RiskListItem[]> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id")
    .eq("year", year)
    .eq("label", label)
    .single();

  if (!period) return [];

  let query = supabase
    .from("risks")
    .select(
      `id,
       reference_number,
       affected_assets,
       threat,
       vulnerability,
       risk_statement,
       status,
       processes ( name, display_order ),
       departments ( code ),
       risk_assessments (
         severity,
         likelihood,
         rpn,
         assessed_at
       )`
    )
    .eq("risk_assessments.type", "residual")
    .eq("risk_assessments.reporting_period_id", period.id);

  // View filter, not a permission one — see kpis/queries.ts getKpisForPeriod.
  if (departmentId) query = query.eq("department_id", departmentId);

  const { data, error } = await query.returns<RiskRow[]>();

  if (error) throw error;

  return (data ?? [])
    .filter(belongsToPeriod)
    .sort(
      (a, b) =>
        order(a.processes?.display_order) - order(b.processes?.display_order) ||
        (a.processes?.name ?? "").localeCompare(b.processes?.name ?? "") ||
        order(a.reference_number) - order(b.reference_number) ||
        a.id.localeCompare(b.id)
    )
    .map((r) => {
      const residual = latestAssessment(r.risk_assessments);
      return {
        id: r.id,
        period: `${label} ${year}`,
        departmentCode: r.departments?.code ?? "",
        processName: r.processes?.name ?? "General",
        title: r.risk_statement ?? r.threat ?? r.affected_assets,
        description: r.vulnerability ?? "",
        likelihood: residual?.likelihood ?? null,
        severity: residual?.severity ?? null,
        riskScore: residual?.rpn ?? null,
        status: STATUS_LABEL[r.status],
      };
    });
}

// ── Risk score trend ─────────────────────────────────────────────────────────

export type QuarterRiskScores = {
  /** "Q1" */
  label: string;
  /** Risks with a residual assessment this quarter AND a baseline. */
  assessed: number;
  /** Average baseline rpn of exactly those risks; null when assessed is 0. */
  baseline: number | null;
  /** Average residual rpn of exactly those risks; null when assessed is 0. */
  residual: number | null;
};

type RiskScoreRow = {
  id: string;
  risk_assessments: {
    type: Enums<"assessment_type">;
    rpn: number | null;
    reporting_period_id: string | null;
    assessed_at: string;
  }[];
};

/**
 * Average score before and after treatment, per quarter of a year, in one
 * round trip.
 *
 * Each quarter averages whichever risks were assessed in it — a risk counts
 * if it has a residual row for that period and a baseline row, and both
 * averages are over exactly that set. The sets differ between quarters
 * (IT: 8 in Q1, 12 in Q2, with 7 retired in between), so the gap between
 * the two lines is what treatment cut, and the count is returned so the
 * chart can say how many risks a point stands on. A quarter with no
 * residuals gets null, never zero.
 *
 * The embed is deliberately unfiltered. A baseline has a null
 * reporting_period_id, so a period filter on the embed drops every
 * baseline; and a second aliased embed carrying its own filter is
 * misrouted by PostgREST onto the unaliased one (probed 16 September,
 * commit 55c88da) — the register's filters vanished and retired risks came
 * back. Everything is fetched and the pairing is done here.
 *
 * No status filter: a risk retired after Q1 was still assessed in Q1 and
 * belongs in Q1's average. No department filter — RLS scopes the read.
 * Raw averages; the UI rounds.
 */
export async function getRiskScoresByQuarter(
  year: number,
  departmentId?: string
): Promise<QuarterRiskScores[]> {
  const periods = await getQuarterlyPeriods(year);
  if (periods.length === 0) return [];

  const supabase = await createClient();

  let query = supabase
    .from("risks")
    .select(
      `id,
       risk_assessments ( type, rpn, reporting_period_id, assessed_at )`
    );

  // View filter, not a permission one — see kpis/queries.ts getKpisForPeriod.
  if (departmentId) query = query.eq("department_id", departmentId);

  const { data, error } = await query.returns<RiskScoreRow[]>();

  if (error) throw error;

  const risks = data ?? [];

  return periods.map((period) => {
    let assessed = 0;
    let baselineSum = 0;
    let residualSum = 0;

    for (const r of risks) {
      const residual = latestAssessment(
        r.risk_assessments.filter(
          (a) => a.type === "residual" && a.reporting_period_id === period.id
        )
      );
      const baseline = latestAssessment(
        r.risk_assessments.filter((a) => a.type === "baseline")
      );
      // rpn is GENERATED ALWAYS from two NOT NULL columns; the null check is
      // for the type, not for a case the data can produce.
      if (residual?.rpn == null || baseline?.rpn == null) continue;
      assessed++;
      baselineSum += baseline.rpn;
      residualSum += residual.rpn;
    }

    return {
      label: period.label,
      assessed,
      baseline: assessed > 0 ? baselineSum / assessed : null,
      residual: assessed > 0 ? residualSum / assessed : null,
    };
  });
}

// ── Risk detail ──────────────────────────────────────────────────────────────

type RiskDetailRow = {
  id: string;
  department_id: string;
  reference_number: number | null;
  affected_assets: string;
  threat: string | null;
  vulnerability: string | null;
  risk_statement: string | null;
  risk_owner_title: string | null;
  status: DbRiskStatus;
  created_at: string;
  processes: { name: string } | null;
  departments: { code: string; name: string } | null;
  risk_assessments: {
    id: string;
    type: Enums<"assessment_type">;
    severity: number;
    likelihood: number;
    rpn: number | null;
    notes: string | null;
    assessed_at: string;
    reporting_period_id: string | null;
    reporting_periods: { year: number; label: string; start_date: string } | null;
  }[];
  risk_treatments: {
    id: string;
    treatment_solution: string;
    monitoring_evidence: string | null;
    owner_title: string | null;
    start_date: string | null;
    target_date: string | null;
    completed_date: string | null;
    status: Enums<"treatment_status">;
    created_at: string;
    risk_treatment_reviews: {
      id: string;
      effectiveness: Enums<"treatment_effectiveness"> | null;
      solution_evidence: string | null;
      reason_for_deviation: string | null;
      followup_measure: string | null;
      reviewed_at: string;
      reporting_periods: { year: number; label: string; start_date: string } | null;
    }[];
  }[];
};

/** One severity × likelihood rating. rpn is GENERATED ALWAYS — display only. */
export type RiskScore = {
  id: string;
  severity: number;
  likelihood: number;
  rpn: number | null;
  notes: string | null;
  assessedAt: string;
};

export type RiskResidualRow = RiskScore & {
  /** "Q1 2026" */
  period: string;
  startDate: string;
};

export type RiskTreatmentReview = {
  id: string;
  /** "Q1 2026" */
  period: string;
  startDate: string;
  effectiveness: Enums<"treatment_effectiveness"> | null;
  solutionEvidence: string | null;
  reasonForDeviation: string | null;
  followupMeasure: string | null;
  reviewedAt: string;
};

export type RiskTreatment = {
  id: string;
  solution: string;
  monitoringEvidence: string | null;
  ownerTitle: string | null;
  startDate: string | null;
  targetDate: string | null;
  completedDate: string | null;
  status: Enums<"treatment_status">;
  reviews: RiskTreatmentReview[];
};

export type RiskDetail = {
  id: string;
  /** Restarts per process every quarter — a label, never an identifier. */
  referenceNumber: number | null;
  affectedAssets: string;
  /** Null on every SRD risk: their historical form has no such column. */
  threat: string | null;
  vulnerability: string | null;
  riskStatement: string | null;
  riskOwnerTitle: string | null;
  status: RiskStatus;
  createdAt: string;
  processName: string;
  department: { code: string; name: string } | null;
  departmentId: string;
  /**
   * The pre-treatment rating. Not tied to a period — its reporting_period_id
   * is null by design, so it renders as its own labelled row, not as a
   * quarter.
   */
  baseline: RiskScore | null;
  /** One per period that holds a residual rating, oldest first. */
  residuals: RiskResidualRow[];
  treatments: RiskTreatment[];
};

/**
 * One risk with every assessment, treatment and treatment review recorded
 * against it.
 *
 * No department filter: RLS scopes the read. null means "no such id" OR
 * "exists in a department this user cannot read" — the two are
 * indistinguishable by design, and the page must treat both as not found.
 *
 * Assessments come back unfiltered so the baseline (null period) survives —
 * an .eq() on reporting_period_id would drop it. Both baseline and residual
 * go through latestAssessment(): the table has no unique constraint on
 * (risk_id, type, reporting_period_id), so a period can in principle hold two
 * residuals and the newest assessed_at wins, exactly as on the register.
 */
export async function getRiskWithHistory(id: string): Promise<RiskDetail | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("risks")
    .select(
      `id,
       department_id,
       reference_number,
       affected_assets,
       threat,
       vulnerability,
       risk_statement,
       risk_owner_title,
       status,
       created_at,
       processes ( name ),
       departments ( code, name ),
       risk_assessments (
         id,
         type,
         severity,
         likelihood,
         rpn,
         notes,
         assessed_at,
         reporting_period_id,
         reporting_periods ( year, label, start_date )
       ),
       risk_treatments (
         id,
         treatment_solution,
         monitoring_evidence,
         owner_title,
         start_date,
         target_date,
         completed_date,
         status,
         created_at,
         risk_treatment_reviews (
           id,
           effectiveness,
           solution_evidence,
           reason_for_deviation,
           followup_measure,
           reviewed_at,
           reporting_periods ( year, label, start_date )
         )
       )`
    )
    .eq("id", id)
    .maybeSingle()
    .returns<RiskDetailRow | null>();

  // 22P02: the URL segment is not a uuid. Not found, same as an unknown id.
  if (error?.code === "22P02") return null;
  if (error) throw error;
  if (!data) return null;

  const toScore = (a: RiskDetailRow["risk_assessments"][number]): RiskScore => ({
    id: a.id,
    severity: a.severity,
    likelihood: a.likelihood,
    rpn: a.rpn,
    notes: a.notes,
    assessedAt: a.assessed_at,
  });

  const baselineRow = latestAssessment(
    data.risk_assessments.filter((a) => a.type === "baseline")
  );

  // Group residuals by period, then keep the newest per period.
  const byPeriod = new Map<string, RiskDetailRow["risk_assessments"]>();
  for (const a of data.risk_assessments) {
    if (a.type !== "residual" || !a.reporting_periods || !a.reporting_period_id) continue;
    byPeriod.set(a.reporting_period_id, [...(byPeriod.get(a.reporting_period_id) ?? []), a]);
  }
  const residuals: RiskResidualRow[] = [...byPeriod.values()]
    .map((rows) => latestAssessment(rows)!)
    .map((a) => {
      const p = a.reporting_periods!;
      return { ...toScore(a), period: `${p.label} ${p.year}`, startDate: p.start_date };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const treatments: RiskTreatment[] = [...data.risk_treatments]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((t) => ({
      id: t.id,
      solution: t.treatment_solution,
      monitoringEvidence: t.monitoring_evidence,
      ownerTitle: t.owner_title,
      startDate: t.start_date,
      targetDate: t.target_date,
      completedDate: t.completed_date,
      status: t.status,
      reviews: t.risk_treatment_reviews
        .filter((r) => r.reporting_periods !== null)
        .map((r) => {
          const p = r.reporting_periods!;
          return {
            id: r.id,
            period: `${p.label} ${p.year}`,
            startDate: p.start_date,
            effectiveness: r.effectiveness,
            solutionEvidence: r.solution_evidence,
            reasonForDeviation: r.reason_for_deviation,
            followupMeasure: r.followup_measure,
            reviewedAt: r.reviewed_at,
          };
        })
        .sort((a, b) => a.startDate.localeCompare(b.startDate)),
    }));

  return {
    id: data.id,
    referenceNumber: data.reference_number,
    affectedAssets: data.affected_assets,
    threat: data.threat,
    vulnerability: data.vulnerability,
    riskStatement: data.risk_statement,
    riskOwnerTitle: data.risk_owner_title,
    status: STATUS_LABEL[data.status],
    createdAt: data.created_at,
    processName: data.processes?.name ?? "General",
    department: data.departments,
    departmentId: data.department_id,
    baseline: baselineRow ? toScore(baselineRow) : null,
    residuals,
    treatments,
  };
}
