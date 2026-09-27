import "server-only";
import { createClient } from "@/lib/supabase/server";
import { normaliseName } from "./review";

export type IndexedKpi = { id: string; target_unit: string | null };

/**
 * The department's active KPIs by normalised name. A name can map to more
 * than one KPI; callers treat that as ambiguous.
 *
 * DELIBERATE DEPARTMENT FILTER — the batch's department, not a permission
 * check. See getImportReview.
 */
export async function kpiIndex(departmentId: string): Promise<Map<string, IndexedKpi[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpis")
    .select("id, name, target_unit")
    .eq("department_id", departmentId)
    .eq("status", "active");
  if (error) throw error;

  const byName = new Map<string, IndexedKpi[]>();
  for (const k of data ?? []) {
    const key = normaliseName(k.name);
    byName.set(key, [...(byName.get(key) ?? []), { id: k.id, target_unit: k.target_unit }]);
  }
  return byName;
}
