import { getCurrentPeriod, getQuarterPeriod } from "@/features/periods/queries";
import { getKpiCountsByQuarter } from "@/features/kpis/queries";
import { getObjectiveCountsByQuarter } from "@/features/objectives/queries";
import { getRisksForPeriod, getRiskScoresByQuarter } from "@/features/risks/queries";
import { getOpenActions } from "@/features/action-items/queries";
import { getPeriodSnapshot } from "@/features/reports/queries";
import { getCurrentUser } from "@/features/auth/queries";
import { getHeaderSignoff } from "@/features/signoff/queries";
import {
  getSelectableDepartments,
  getQuarterTracker,
  getDepartmentPerformance,
  getOverdueActions,
  getQuarterOpenState,
} from "@/features/dashboard/queries";
import {
  companyTotals,
  companyTrend,
  departmentStandings,
} from "@/features/dashboard/company";
import { isAdmin } from "@/lib/permissions";
import DepartmentDashboard from "@/features/dashboard/components/DepartmentDashboard";
import DepartmentViewSelector from "@/features/dashboard/components/DepartmentViewSelector";
import { OWN_CODE, resolveDashboardView } from "@/features/dashboard/view";
import QuarterTracker from "@/features/dashboard/components/QuarterTracker";
import CompanyOverview from "@/features/dashboard/components/CompanyOverview";

/**
 * The department a non-IMS user's dashboard is about, for the title.
 *
 * Exactly one department role means one unambiguous name. Nobody, or two,
 * means the page is an RLS-scoped pool with no single department to name —
 * the same rule getHeaderSignoff uses to decide whether sign-off applies.
 */
function soleDepartmentName(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  const byId = new Map(
    (user?.roles ?? [])
      .filter((r) => r.departmentId && r.departmentName)
      .map((r) => [r.departmentId, r.departmentName as string])
  );
  return byId.size === 1 ? [...byId.values()][0] : null;
}

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

  // One resolution decides both what renders and what the dropdown shows,
  // so the two cannot drift apart.
  const resolved = resolveDashboardView(
    { view, dept },
    departments.map((d) => d.code)
  );
  const showCompany = ims && resolved.kind === "tracker";
  const selected =
    ims && resolved.kind === "department"
      ? departments.find((d) => d.code === resolved.code)
      : undefined;

  const viewSelector = ims ? (
    <DepartmentViewSelector
      departments={departments}
      value={resolved.selection}
      ownCode={OWN_CODE}
    />
  ) : null;

  /* ── Company overview: every department together ── */
  if (showCompany) {
    // The whole year in one call: the cards, the heatmap and the bar chart
    // read the selected quarter out of it, and the trend reads all four.
    const [performance, overdue, openQuarters] = await Promise.all([
      getDepartmentPerformance(Number(activeYear)),
      getOverdueActions(),
      getQuarterOpenState(Number(activeYear)),
    ]);

    const thisQuarter = performance.filter((r) => r.quarter === activeQuarter);

    return (
      <CompanyOverview
        key={`${activeYear}-${activeQuarter}`}
        year={activeYear}
        quarter={activeQuarter}
        // A quarter still accepting figures cannot be scored, only
        // reported on — the cells stay uncoloured until everything due
        // has arrived.
        periodOpen={openQuarters[activeQuarter] ?? false}
        totals={companyTotals(thisQuarter, overdue)}
        standings={departmentStandings(
          thisQuarter,
          overdue.byDepartment,
          overdue.openByDepartment
        )}
        trend={companyTrend(performance, openQuarters)}
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

  // Chasing the other departments' quarters is IMS's own work, so it sits
  // under IMS's own dashboard rather than under a view about everyone
  // else's numbers. Only there: a department looking at its own dashboard
  // has one quarter to care about and the header already shows it.
  const ownView = ims && resolved.kind === "department" && resolved.code === OWN_CODE;

  let tracker: React.ReactNode = null;
  if (ownView) {
    const period = await getQuarterPeriod(Number(activeYear), activeQuarter);
    const closed = !period || period.status === "closed";
    const rows = period && !closed ? await getQuarterTracker(period.id) : [];

    tracker = (
      <section className="space-y-3 pt-3">
        <h2 className="text-lg font-semibold tracking-tight text-ink">
          Quarterly reporting
        </h2>
        <p className="text-sm text-muted-foreground">
          Where every department stands on {activeQuarter} {activeYear}.
        </p>
        {/* Q1 and Q2 were signed on paper; there is no trail to show. */}
        <QuarterTracker rows={rows} closed={closed} />
      </section>
    );
  }

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
      departmentName={selected?.name ?? soleDepartmentName(user)}
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
      footer={tracker}
    />
  );
}
