import { createClient } from "@/lib/supabase/server";
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

type Measurement = KpiRow["kpi_measurements"][number];

function toStatus(m: Measurement | undefined): KpiStatus {
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
        processName: k.processes?.name ?? "General",
        name: k.name,
        target: k.target_text ?? "",
        actual: m?.actual_text ?? "",
        status: toStatus(m),
        justification: m?.remark ?? "",
      };
    });
}