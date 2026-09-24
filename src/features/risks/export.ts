"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import type { ExportResult } from "@/lib/export/types";
import { riskBand, RISK_BAND_LABEL } from "./scoring";
import { getRiskDefinitions, getRisksForPeriod } from "./queries";

export type RiskExportRow = {
  /** Not a file column: RISK_EXPORT_COLUMNS lists what is written. For links to the item. */
  id: string;
  department: string;
  /** reference_number as text; display only — it is not an identifier. */
  ref: string;
  riskStatement: string;
  owner: string;
  /** "12 (4×3)" — rpn with severity × likelihood; "—" when not assessed. */
  score: string;
  band: string;
  /** Register status, or "Retired (last assessed Q1 2026)" / "Not in this period" for a row the period does not hold. */
  status: string;
};

const exportInput = z.object({
  ids: z.array(z.uuid()).min(1).max(1000),
  year: z.number().int().min(2000).max(2100),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
});

/**
 * The ticked risks for one period, ready to write to a file.
 *
 * Reads through getRisksForPeriod on the signed-in user's client, so RLS
 * applies exactly as on the page.
 *
 * Every ticked risk the caller can see comes back as a row, even one the
 * period's register does not hold — a risk retired before this quarter.
 * Those follow the register rows, with no score and a status that says
 * why, so nothing ticked drops out of the file unannounced.
 */
export async function exportRisks(
  ids: string[],
  year: number,
  quarter: string
): Promise<ExportResult<RiskExportRow>> {
  const parsed = exportInput.safeParse({ ids, year, quarter });
  if (!parsed.success) return { ok: false, message: "Nothing valid to export." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Your session has ended. Sign in again." };

  const p = parsed.data;
  const inPeriod = await getRisksForPeriod(p.year, p.quarter, undefined, p.ids);
  const listed = new Set(inPeriod.map((r) => r.id));
  const missing = [...new Set(p.ids)].filter((id) => !listed.has(id));
  const notInPeriod = missing.length > 0 ? await getRiskDefinitions(missing) : [];

  // Only when every id was invisible to the caller. Same words whatever the
  // reason, so the message says nothing about ids they cannot read.
  if (inPeriod.length + notInPeriod.length === 0) {
    return { ok: false, message: "Nothing to export." };
  }

  const byDepartment = (a: RiskExportRow, b: RiskExportRow) =>
    a.department.localeCompare(b.department);

  return {
    ok: true,
    title: `Risks · ${p.quarter} ${p.year}`,
    exportedAt: new Date().toISOString(),
    exportedBy: user.fullName,
    // Grouped by department, keeping the register's order within each.
    // Array.prototype.sort is stable.
    rows: [
      ...inPeriod
        .map((r) => ({
          id: r.id,
          department: r.departmentCode,
          ref: r.referenceNumber === null ? "" : String(r.referenceNumber),
          riskStatement: r.title,
          owner: r.ownerTitle ?? "",
          score:
            r.riskScore === null
              ? "—"
              : r.severity !== null && r.likelihood !== null
                ? `${r.riskScore} (${r.severity}×${r.likelihood})`
                : String(r.riskScore),
          band: RISK_BAND_LABEL[riskBand(r.riskScore)],
          status: r.status,
        }))
        .sort(byDepartment),
      ...notInPeriod
        .map((r) => ({
          id: r.id,
          department: r.departmentCode,
          ref: r.referenceNumber === null ? "" : String(r.referenceNumber),
          riskStatement: r.title,
          owner: r.ownerTitle ?? "",
          score: "—",
          // Not "Not assessed": that is the register's word for a live risk
          // still waiting for this quarter's rating.
          band: "—",
          status:
            r.status !== "retired"
              ? "Not in this period"
              : r.lastAssessed
                ? `Retired (last assessed ${r.lastAssessed})`
                : "Retired",
        }))
        .sort(byDepartment),
    ],
  };
}
