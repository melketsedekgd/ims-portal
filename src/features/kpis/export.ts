"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import type { ExportResult } from "@/lib/export/types";
import type { KpiStatus } from "./types";
import { getKpisForPeriod } from "./queries";

export type KpiExportRow = {
  department: string;
  process: string;
  kpi: string;
  target: string;
  /** For the period; "N/A" when recorded as not measured, "" when not entered. */
  actual: string;
  status: string;
};

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
});

/**
 * The ticked KPIs for one period, ready to write to a file.
 *
 * Reads through getKpisForPeriod on the signed-in user's client, so RLS
 * applies exactly as on the page: an id from a department the caller cannot
 * read comes back as no row, not as an error. No department filter here —
 * the ids are the whole selection, whichever departments they are in.
 */
export async function exportKpis(
  ids: string[],
  year: number,
  quarter: string
): Promise<ExportResult<KpiExportRow>> {
  const parsed = exportInput.safeParse({ ids, year, quarter });
  if (!parsed.success) return { ok: false, message: "Nothing valid to export." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your session has ended. Sign in again." };

  const p = parsed.data;
  const rows = await getKpisForPeriod(p.year, p.quarter, undefined, p.ids);

  return {
    ok: true,
    title: `KPIs · ${p.quarter} ${p.year}`,
    exportedAt: new Date().toISOString(),
    exportedBy: user.fullName,
    // Grouped by department, keeping the query's process order within each.
    // Array.prototype.sort is stable.
    rows: rows
      .map((r) => ({
        department: r.departmentCode,
        process: r.processName,
        kpi: r.name,
        target: r.target,
        actual: r.actual ?? "",
        status: STATUS_LABEL[r.status],
      }))
      .sort((a, b) => a.department.localeCompare(b.department)),
  };
}
