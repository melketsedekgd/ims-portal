"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import type { ExportResult } from "@/lib/export/types";
import { exportColumnsFor, pickColumns, type ExportedRow, type ExportRow } from "@/lib/columns";
import type { KpiStatus } from "./types";
import { KPI_COLUMNS, type KpiColumnKey } from "./columns";
import { getKpiDefinitions, getKpisForPeriod } from "./queries";

/**
 * One KPI as the file has it: the chosen columns only, plus the id (not a
 * file column; for links to the item). Actual is "N/A" when recorded as
 * not measured, "" when not entered, "—" when the KPI is not on the
 * period's list.
 */
export type KpiExportRow = ExportedRow<KpiColumnKey>;

const STATUS_LABEL: Record<KpiStatus, string> = {
  Achieved: "On target",
  Deviated: "Below target",
  "Not Measured": "N/A",
  Pending: "Not entered",
};

const exportInput = z.object({
  ids: z.array(z.uuid()).min(1).max(1000),
  year: z.number().int().min(2000).max(2100),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  // Resolved against KPI_COLUMNS: unknown keys dropped, Metric always in.
  columns: z.array(z.string().max(64)).max(50),
});

/**
 * The ticked KPIs for one period, ready to write to a file.
 *
 * Reads through getKpisForPeriod on the signed-in user's client, so RLS
 * applies exactly as on the page: an id from a department the caller cannot
 * read comes back as no row, not as an error. No department filter here —
 * the ids are the whole selection, whichever departments they are in.
 *
 * Every ticked KPI the caller can see comes back as a row. One the
 * period's list does not hold — a retired KPI — follows the list rows with
 * its definition, "—" for the period's figures, and a status that says why.
 *
 * `columns` are the table's chosen column keys; the file has Process and
 * then those, in KPI_COLUMNS order, and the rows hold nothing else.
 */
export async function exportKpis(
  ids: string[],
  year: number,
  quarter: string,
  columns: string[]
): Promise<ExportResult<KpiExportRow>> {
  const parsed = exportInput.safeParse({ ids, year, quarter, columns });
  if (!parsed.success) return { ok: false, message: "Nothing valid to export." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your session has ended. Sign in again." };

  const p = parsed.data;
  const inPeriod = await getKpisForPeriod(p.year, p.quarter, undefined, p.ids);
  const listed = new Set(inPeriod.map((r) => r.id));
  const missing = [...new Set(p.ids)].filter((id) => !listed.has(id));
  const notInPeriod = missing.length > 0 ? await getKpiDefinitions(missing) : [];

  // Only when every id was invisible to the caller. Same words whatever the
  // reason, so the message says nothing about ids they cannot read.
  if (inPeriod.length + notInPeriod.length === 0) {
    return { ok: false, message: "Nothing to export." };
  }

  type Row = ExportRow<KpiColumnKey>;
  const byDepartment = (a: Row, b: Row) => a.dept.localeCompare(b.dept);
  const fileColumns = exportColumnsFor(KPI_COLUMNS, p.columns);

  // Grouped by department, keeping the query's process order within each.
  // Array.prototype.sort is stable.
  const rows: Row[] = [
    ...inPeriod
      .map((r) => ({
        id: r.id,
        process: r.processName,
        metric: r.name,
        dept: r.departmentCode,
        responsibility: r.responsibility ?? "",
        target: r.target,
        actual: r.actual ?? "",
        achievement: r.achievementPercentage ?? "",
        status: STATUS_LABEL[r.status],
        remark: r.justification ?? "",
        data_source: r.dataSource ?? "",
        frequency: r.analysisFrequency ?? "",
        methodology: r.analysisMethodology ?? "",
        evidence: r.evidenceNames.join(", "),
      }))
      .sort(byDepartment),
    // Definition fields are the KPI's own; the period's figures are "—".
    ...notInPeriod
      .map((k) => ({
        id: k.id,
        process: k.processName,
        metric: k.name,
        dept: k.departmentCode,
        responsibility: k.responsibility,
        target: k.target,
        actual: "—",
        achievement: "—",
        status: k.status === "retired" ? "Retired" : "Not in this period",
        remark: "—",
        data_source: k.dataSource,
        frequency: k.frequency,
        methodology: k.methodology,
        evidence: "—",
      }))
      .sort(byDepartment),
  ];

  return {
    ok: true,
    title: `KPIs · ${p.quarter} ${p.year}`,
    exportedAt: new Date().toISOString(),
    exportedBy: user.fullName,
    columns: fileColumns,
    rows: rows.map((r) => pickColumns(r, fileColumns)),
  };
}
