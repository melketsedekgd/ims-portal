import { notFound } from "next/navigation";
import { getObjectiveWithHistory } from "@/features/objectives/queries";
import ObjectiveDetail from "@/features/objectives/components/ObjectiveDetail";

export default async function ObjectiveDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const [{ id }, { year, quarter }] = await Promise.all([params, searchParams]);

  const objective = await getObjectiveWithHistory(id);

  // null is "no such id" OR "an objective in a department this user cannot
  // read" — RLS makes them indistinguishable on purpose. Both are a 404. Do
  // not turn this into an error state: that would confirm the id exists to
  // someone who is not allowed to know.
  if (!objective) notFound();

  // The objectives page owns the period in its URL; carry it back so the user
  // returns to the quarter they left rather than the default one.
  const back = new URLSearchParams();
  if (year) back.set("year", year);
  if (quarter) back.set("quarter", quarter);
  const backHref = back.size > 0 ? `/department/objectives?${back}` : "/department/objectives";

  return <ObjectiveDetail objective={objective} backHref={backHref} />;
}
