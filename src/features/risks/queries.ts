import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
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
  risk_assessments: {
    severity: number;
    likelihood: number;
    rpn: number | null;
    assessed_at: string;
  }[];
};

type Assessment = RiskRow["risk_assessments"][number];

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
function latestAssessment(assessments: Assessment[]): Assessment | undefined {
  return assessments.reduce<Assessment | undefined>(
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
  label: string
): Promise<RiskListItem[]> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id")
    .eq("year", year)
    .eq("label", label)
    .single();

  if (!period) return [];

  const { data, error } = await supabase
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
       risk_assessments (
         severity,
         likelihood,
         rpn,
         assessed_at
       )`
    )
    .eq("risk_assessments.type", "residual")
    .eq("risk_assessments.reporting_period_id", period.id)
    .returns<RiskRow[]>();

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
