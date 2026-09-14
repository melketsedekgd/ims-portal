import { createClient } from "@/lib/supabase/server";
import { getQuarterlyPeriods } from "@/features/periods/queries";
import type { KpiFormData, KpiStatus } from "@/components/forms/KpiForm";

type KpiRow = {
  id: string;
  name: string;
  target_text: string | null;
  target_unit: string | null;
  display_order: number | null;
  processes: { name: string; display_order: number | null } | null;
  kpi_measurements: {
    actual_value: number | null;
    actual_text: string | null;
    not_measured: boolean;
    remark: string | null;
    evidence_reference: string | null;
    kpi_achievement_ratio: number | null;
  }[];
};

/**
 * A tracking-table row: the display shape plus the raw measurement fields the
 * entry dialog edits, so it can be pre-filled without a second fetch.
 */
export type KpiTrackingRow = KpiFormData & {
  unit: string | null;
  actualValue: number | null;
  notMeasured: boolean;
};

/**
 * The only fields that decide a KPI's status. Typed structurally so the
 * per-period list and the year series share one definition of "Achieved"
 * rather than each carrying its own copy of the rule.
 */
type AchievementFields = {
  not_measured: boolean;
  kpi_achievement_ratio: number | null;
};

function toStatus(m: AchievementFields | undefined): KpiStatus {
  // A recorded "not measured" is an answer; a missing row is the absence of
  // one. Checked first so it can never fall through to Pending or Deviated.
  if (m?.not_measured) return "Not Measured";
  if (!m || m.kpi_achievement_ratio === null) return "Pending";
  return m.kpi_achievement_ratio >= 1 ? "Achieved" : "Deviated";
}

const order = (n: number | null | undefined) => n ?? 9999;

export async function getKpisForPeriod(
  year: number,
  label: string
): Promise<KpiTrackingRow[]> {
  const supabase = await createClient();

  const { data: period } = await supabase
    .from("reporting_periods")
    .select("id")
    .eq("year", year)
    .eq("label", label)
    .single();

  if (!period) return [];

  const { data, error } = await supabase
    .from("kpis")
    .select(
      `id,
       name,
       target_text,
       target_unit,
       display_order,
       processes ( name, display_order ),
       kpi_measurements (
         actual_value,
         actual_text,
         not_measured,
         remark,
         evidence_reference,
         kpi_achievement_ratio
       )`
    )
    .eq("status", "active")
    .eq("kpi_measurements.reporting_period_id", period.id)
    .returns<KpiRow[]>();

  if (error) throw error;

  return (data ?? [])
    .sort(
      (a, b) =>
        order(a.processes?.display_order) - order(b.processes?.display_order) ||
        order(a.display_order) - order(b.display_order)
    )
    .map((k) => {
      const m = k.kpi_measurements[0];
      return {
        id: k.id,
        period: `${label} ${year}`,
        processName: k.processes?.name ?? "General",
        name: k.name,
        target: k.target_text ?? "",
        // actual_text is the human form from the reports ("8hr 27 mins").
        // Entries made through the form may carry only a number.
        // "N/A", not "-" or 0: not_measured is a value in its own right.
        actual: m?.not_measured
          ? "N/A"
          : m?.actual_text ??
            (m?.actual_value != null
              ? [m.actual_value, k.target_unit].filter(Boolean).join(" ")
              : ""),
        achievementPercentage: m?.not_measured
          ? "N/A"
          : m?.kpi_achievement_ratio != null
            ? `${Math.round(m.kpi_achievement_ratio * 100)}%`
            : "",
        status: toStatus(m),
        justification: m?.remark ?? "",
        evidence: m?.evidence_reference ?? "",
        unit: k.target_unit,
        actualValue: m?.actual_value ?? null,
        notMeasured: m?.not_measured ?? false,
      };
    });
}

export type QuarterKpiCounts = {
  label: string;
  achieved: number;
  deviated: number;
  pending: number;
  /** Recorded as not measured. Counted in total, never in the other three. */
  notMeasured: number;
  total: number;
};

type KpiSeriesRow = {
  id: string;
  kpi_measurements: (AchievementFields & { reporting_period_id: string })[];
};

/**
 * KPI status counts for every quarter of a year, in one round trip.
 *
 * The measurement embed is filtered with .in() over all four period ids rather
 * than .eq() over one, so a single query covers the whole series. Calling
 * getKpisForPeriod four times would cost four period lookups and four list
 * queries, and would still have to agree with this by convention; here the
 * same toStatus() decides both, so the chart and the table cannot disagree.
 */
export async function getKpiCountsByQuarter(
  year: number
): Promise<QuarterKpiCounts[]> {
  const periods = await getQuarterlyPeriods(year);
  if (periods.length === 0) return [];

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .select(
      `id,
       kpi_measurements (
         reporting_period_id,
         not_measured,
         kpi_achievement_ratio
       )`
    )
    .eq("status", "active")
    .in(
      "kpi_measurements.reporting_period_id",
      periods.map((p) => p.id)
    )
    .returns<KpiSeriesRow[]>();

  if (error) throw error;

  const kpis = data ?? [];

  return periods.map((period) => {
    const counts: QuarterKpiCounts = {
      label: period.label,
      achieved: 0,
      deviated: 0,
      pending: 0,
      notMeasured: 0,
      total: kpis.length,
    };

    for (const k of kpis) {
      const m = k.kpi_measurements.find(
        (row) => row.reporting_period_id === period.id
      );
      switch (toStatus(m)) {
        case "Achieved":
          counts.achieved++;
          break;
        case "Deviated":
          counts.deviated++;
          break;
        case "Pending":
          counts.pending++;
          break;
        case "Not Measured":
          counts.notMeasured++;
          break;
      }
    }

    return counts;
  });
}
