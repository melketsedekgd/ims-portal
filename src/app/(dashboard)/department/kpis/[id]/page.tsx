import { notFound } from "next/navigation";
import { getKpiWithHistory } from "@/features/kpis/queries";
import KpiDetail from "@/features/kpis/components/KpiDetail";

export default async function KpiDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const [{ id }, { year, quarter }] = await Promise.all([params, searchParams]);

  const kpi = await getKpiWithHistory(id);

  // null is "no such id" OR "a KPI in a department this user cannot read" —
  // RLS makes them indistinguishable on purpose. Both are a 404. Do not turn
  // this into an error state: that would confirm the id exists to someone
  // who is not allowed to know.
  if (!kpi) notFound();

  // The tracking page owns the period in its URL; carry it back so the user
  // returns to the quarter they left rather than the default one.
  const back = new URLSearchParams();
  if (year) back.set("year", year);
  if (quarter) back.set("quarter", quarter);
  const backHref = back.size > 0 ? `/department/kpis?${back}` : "/department/kpis";

  return <KpiDetail kpi={kpi} backHref={backHref} />;
}
