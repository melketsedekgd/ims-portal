import { createClient } from "@/lib/supabase/server";
import { getQuarterlyPeriods } from "@/features/periods/queries";
import type { KpiFormData, KpiStatus } from "@/components/forms/KpiForm";

type KpiRow = {
  id: string;
  name: string;
  target_text: string | null;
  display_order: number | null;
  processes: { name: string; display_order: number | null } | null;
  kpi_measurements: {
    actual_text: string | null;
    not_measured: boolean;
    remark: string | null;
    kpi_achievement_ratio: number | null;
  }[];
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
  if (!m || m.not_measured || m.kpi_achievement_ratio === null) return "Pending";
  return m.kpi_achievement_ratio >= 1 ? "Achieved" : "Deviated";
}

const order = (n: number | null | undefined) => n ?? 9999;

export async function getKpisForPeriod(
  year: number,
  label: string
): Promise<KpiFormData[]> {
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
       display_order,
       processes ( name, display_order ),
       kpi_measurements (
         actual_text,
         not_measured,
         remark,
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
        actual: m?.actual_text ?? "",
        achievementPercentage:
          m?.kpi_achievement_ratio != null
            ? `${Math.round(m.kpi_achievement_ratio * 100)}%`
            : "",
        status: toStatus(m),
        justification: m?.remark ?? "",
      };
    });
}

export type QuarterKpiCounts = {
  label: string;
  achieved: number;
  deviated: number;
  pending: number;
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
      }
    }

    return counts;
  });
}
