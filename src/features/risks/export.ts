"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import type { ExportResult } from "@/lib/export/types";
import { riskBand, RISK_BAND_LABEL } from "./scoring";
import { getRisksForPeriod } from "./queries";

export type RiskExportRow = {
  department: string;
  /** reference_number as text; display only — it is not an identifier. */
  ref: string;
  riskStatement: string;
  owner: string;
  /** "12 (4×3)" — rpn with severity × likelihood; "—" when not assessed. */
  score: string;
  band: string;
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
 * applies exactly as on the page, and so does the register's rule for which
 * risks belong to a period: a risk retired before this quarter is not on
 * this quarter's register and is not exported for it either.
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
  const rows = await getRisksForPeriod(p.year, p.quarter, undefined, p.ids);

  return {
    ok: true,
    title: `Risks · ${p.quarter} ${p.year}`,
    exportedAt: new Date().toISOString(),
    exportedBy: user.fullName,
    // Grouped by department, keeping the register's order within each.
    rows: rows
      .map((r) => ({
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
      .sort((a, b) => a.department.localeCompare(b.department)),
  };
}
