import { notFound } from "next/navigation";
import { getRiskSuggestions, getRiskWithHistory } from "@/features/risks/queries";
import { getEvidenceFor, type Evidence } from "@/features/evidence/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { getQuarterLocks } from "@/features/quarter-lock/queries";
import { isAdmin, managedDepartmentIds } from "@/lib/permissions";
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

  const reviews = risk.treatments.flatMap((t) => t.reviews);
  const reviewIds = reviews.map((r) => r.id);
  // The locks need to know whether the user is an admin (a closed period
  // binds everyone else), so they chain off the user rather than wait in line.
  const userPromise = getCurrentUser();
  const [treatmentEvidenceLists, reviewEvidenceLists, user, locks] = await Promise.all([
    Promise.all(risk.treatments.map((t) => getEvidenceFor("risk_treatment", t.id))),
    Promise.all(reviewIds.map((id) => getEvidenceFor("risk_treatment_review", id))),
    userPromise,
    userPromise.then((u) =>
      getQuarterLocks(
        risk.departmentId,
        reviews.map((r) => r.periodId),
        { isAdmin: isAdmin(u) }
      )
    ),
  ]);
  const evidenceByTreatment: Record<string, Evidence[]> = {};
  risk.treatments.forEach((t, i) => {
    evidenceByTreatment[t.id] = treatmentEvidenceLists[i];
  });
  const evidenceByReview: Record<string, Evidence[]> = {};
  reviewIds.forEach((id, i) => {
    evidenceByReview[id] = reviewEvidenceLists[i];
  });

  const canManage = isAdmin(user) || managedDepartmentIds(user).includes(risk.departmentId);

  // Owner titles for the treatment edit dialog, which only managers see.
  const ownerTitles = canManage
    ? (await getRiskSuggestions([risk.departmentId]))[risk.departmentId].ownerTitles
    : [];

  // The register owns the period in its URL; carry it back so the user
  // returns to the quarter they left rather than the default one.
  const back = new URLSearchParams();
  if (year) back.set("year", year);
  if (quarter) back.set("quarter", quarter);
  const backHref = back.size > 0 ? `/department/risks?${back}` : "/department/risks";

  return (
    <RiskDetail
      risk={risk}
      backHref={backHref}
      evidenceByTreatment={evidenceByTreatment}
      evidenceByReview={evidenceByReview}
      canManage={canManage}
      locks={locks}
      ownerTitles={ownerTitles}
      path={`/department/risks/${id}`}
    />
  );
}
