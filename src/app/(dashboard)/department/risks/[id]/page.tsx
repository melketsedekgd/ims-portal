import { notFound } from "next/navigation";
import { getRiskWithHistory } from "@/features/risks/queries";
import RiskDetail from "@/features/risks/components/RiskDetail";

export default async function RiskDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const [{ id }, { year, quarter }] = await Promise.all([params, searchParams]);

  const risk = await getRiskWithHistory(id);

  // null is "no such id" OR "a risk in a department this user cannot read" —
  // RLS makes them indistinguishable on purpose. Both are a 404. Do not turn
  // this into an error state: that would confirm the id exists to someone
  // who is not allowed to know.
  if (!risk) notFound();

  // The register owns the period in its URL; carry it back so the user
  // returns to the quarter they left rather than the default one.
  const back = new URLSearchParams();
  if (year) back.set("year", year);
  if (quarter) back.set("quarter", quarter);
  const backHref = back.size > 0 ? `/department/risks?${back}` : "/department/risks";

  return <RiskDetail risk={risk} backHref={backHref} />;
}
