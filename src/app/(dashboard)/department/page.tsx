import { getCurrentPeriod, getQuarterPeriod } from "@/features/periods/queries";
import { getKpiCountsByQuarter } from "@/features/kpis/queries";
import { getObjectiveCountsByQuarter } from "@/features/objectives/queries";
import { getRisksForPeriod, getRiskScoresByQuarter } from "@/features/risks/queries";
import { getOpenActions } from "@/features/action-items/queries";
import { getPeriodSnapshot } from "@/features/reports/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { getHeaderSignoff } from "@/features/signoff/queries";
import { getSelectableDepartments, getQuarterTracker } from "@/features/dashboard/queries";
import { isAdmin } from "@/lib/permissions";
import DepartmentDashboard from "@/features/dashboard/components/DepartmentDashboard";
import DepartmentViewSelector, {
  ALL_DEPARTMENTS,
} from "@/features/dashboard/components/DepartmentViewSelector";
import QuarterTracker from "@/features/dashboard/components/QuarterTracker";

/** IMS's own department. The view an IMS user lands on. */
const OWN_CODE = "IMS";

export default async function DepartmentDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    quarter?: string;
    view?: string;
    dept?: string;
  }>;
}) {
  const { year, quarter, view, dept } = await searchParams;

  // The URL wins when it says anything; getCurrentPeriod only fills the gaps.
  const current = await getCurrentPeriod();
  const activeYear = year ?? String(current.year);
  const activeQuarter = quarter ?? current.label;

  // "Live" means the selected period is the current reporting period, resolved
  // from reporting_periods by date range — not from the browser's clock.
  const isLive =
    activeYear === String(current.year) && activeQuarter === current.label;

  // Only IMS gets a choice of department. For everyone else ?view and ?dept
  // are ignored entirely: their dashboard is whatever RLS shows them, exactly
  // as it was. An IT contributor who types ?dept=SRD is not refused, because
  // there is nothing to refuse — RLS never gave them SRD's rows to narrow.
  const user = await getCurrentUser();
  const ims = isAdmin(user);

  const departments = ims ? await getSelectableDepartments() : [];
  const showTracker = ims && view === ALL_DEPARTMENTS;

  // An unknown code falls back to IMS's own dashboard rather than erroring or
  // silently widening to everything: the selector cannot produce one, so it
  // means a hand-edited URL, and the default view is the least surprising
  // place to land.
  const selected = ims && !showTracker
    ? departments.find((d) => d.code === (dept ?? OWN_CODE)) ??
      departments.find((d) => d.code === OWN_CODE)
    : undefined;

  const viewSelector = ims ? (
    <DepartmentViewSelector
      departments={departments}
      value={showTracker ? ALL_DEPARTMENTS : selected?.code ?? OWN_CODE}
      ownCode={OWN_CODE}
    />
  ) : null;

  /* ── All departments: the quarterly reporting tracker ── */
  if (showTracker) {
    const period = await getQuarterPeriod(Number(activeYear), activeQuarter);
    const rows =
      period && period.status !== "closed"
        ? await getQuarterTracker(period.id)
        : [];

    return (
      <QuarterTracker
        key={`${activeYear}-${activeQuarter}`}
        year={activeYear}
        quarter={activeQuarter}
        rows={rows}
        /** Q1 and Q2 were signed on paper; there is no trail to show. */
        closed={!period || period.status === "closed"}
        viewSelector={viewSelector}
      />
    );
  }

  /* ── One department ── */

  // Undefined for everyone but IMS, which is the pre-existing behaviour:
  // department-agnostic queries, scoped by RLS alone.
  const scopeId = selected?.id;

  // The KPI and objective year-series already contain the selected quarter, so
  // the overview cards read from them rather than issuing their own counts.
  // The cards and the charts then cannot disagree.
  //
  // The period snapshot runs its own three list queries, one of which
  // (getRisksForPeriod) is also issued here. Deliberately not deduped by
  // passing risks in: the snapshot would then have two sources for its
  // inputs and they would drift. getCurrentUser is React-cached and the
  // layout already called it.
  const [kpiSeries, objectiveSeries, risks, riskSeries, actions, snapshot, signoff] =
    await Promise.all([
      getKpiCountsByQuarter(Number(activeYear), scopeId),
      getObjectiveCountsByQuarter(Number(activeYear), scopeId),
      getRisksForPeriod(Number(activeYear), activeQuarter, scopeId),
      getRiskScoresByQuarter(Number(activeYear), scopeId),
      getOpenActions(8, scopeId),
      getPeriodSnapshot(Number(activeYear), activeQuarter, scopeId),
      getHeaderSignoff(Number(activeYear), activeQuarter, scopeId),
    ]);

  const preparedBy = user
    ? [user.fullName, user.jobTitle].filter(Boolean).join(" — ")
    : "Unknown user";

  // A department with no KPIs, no objectives and no risks at all — IMS today.
  // Read off the series rather than counted again, so "empty" here means the
  // same thing the charts would have drawn. Only ever true for a named
  // department: without one this is an RLS-scoped pool, and an empty pool is
  // a permissions result, not an unset-up department.
  const isEmpty =
    !!selected &&
    kpiSeries.every((q) => q.total === 0) &&
    objectiveSeries.every((q) => q.total === 0) &&
    risks.length === 0;

  return (
    <DepartmentDashboard
      key={`${activeYear}-${activeQuarter}-${selected?.code ?? "own"}`}
      year={activeYear}
      quarter={activeQuarter}
      isLive={isLive}
      departmentName={selected?.name ?? null}
      isEmpty={isEmpty}
      kpiSeries={kpiSeries}
      objectiveSeries={objectiveSeries}
      risks={risks}
      riskSeries={riskSeries}
      actions={actions}
      snapshot={snapshot}
      preparedBy={preparedBy}
      signoff={signoff}
      viewSelector={viewSelector}
    />
  );
}
