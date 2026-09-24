"use server";

import { z } from "zod";
import { getCurrentUser } from "@/features/auth/queries";
import type { ExportResult } from "@/lib/export/types";
import { exportColumnsFor, pickColumns, type ExportedRow, type ExportRow } from "@/lib/columns";
import { riskBand, RISK_BAND_LABEL } from "./scoring";
import { RISK_COLUMNS, type RiskColumnKey } from "./columns";
import { getRiskDefinitions, getRisksForPeriod } from "./queries";

/**
 * One risk as the file has it: the chosen columns only, plus the id (not a
 * file column; for links to the item). Ref is reference_number as text,
 * display only — not an identifier. Status is the register's, or "Retired
 * (last assessed Q1 2026)" / "Not in this period" for a row the period
 * does not hold.
 */
export type RiskExportRow = ExportedRow<RiskColumnKey>;

const exportInput = z.object({
  ids: z.array(z.uuid()).min(1).max(1000),
  year: z.number().int().min(2000).max(2100),
  quarter: z.enum(["Q1", "Q2", "Q3", "Q4"]),
  // Resolved against RISK_COLUMNS: unknown keys dropped, Risk always in.
  columns: z.array(z.string().max(64)).max(50),
});

/**
 * The ticked risks for one period, ready to write to a file.
 *
 * Reads through getRisksForPeriod on the signed-in user's client, so RLS
 * applies exactly as on the page.
 *
 * Every ticked risk the caller can see comes back as a row, even one the
 * period's register does not hold — a risk retired before this quarter.
 * Those follow the register rows, with their definition, "—" for the
 * period's rating and a status that says why, so nothing ticked drops out
 * of the file unannounced.
 *
 * `columns` are the table's chosen column keys; the file has Process and
 * then those, in RISK_COLUMNS order, and the rows hold nothing else.
 */
export async function exportRisks(
  ids: string[],
  year: number,
  quarter: string,
  columns: string[]
): Promise<ExportResult<RiskExportRow>> {
  const parsed = exportInput.safeParse({ ids, year, quarter, columns });
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

  type Row = ExportRow<RiskColumnKey>;
  const byDepartment = (a: Row, b: Row) => a.dept.localeCompare(b.dept);
  const fileColumns = exportColumnsFor(RISK_COLUMNS, p.columns);
  const ref = (n: number | null) => (n === null ? "" : String(n));

  // Grouped by department, keeping the register's order within each.
  // Array.prototype.sort is stable.
  const rows: Row[] = [
    ...inPeriod
      .map((r) => ({
        id: r.id,
        process: r.processName,
        risk: r.title,
        dept: r.departmentCode,
        ref: ref(r.referenceNumber),
        // Likelihood × severity, as the table's L × S column reads.
        ls: r.likelihood === null || r.severity === null ? "—" : `${r.likelihood} × ${r.severity}`,
        score: r.riskScore === null ? "—" : String(r.riskScore),
        band: RISK_BAND_LABEL[riskBand(r.riskScore)],
        status: r.status,
        owner: r.ownerTitle ?? "",
        affected_assets: r.affectedAssets,
        threat: r.threat ?? "",
        vulnerability: r.vulnerability ?? "",
        treatment: r.treatment ?? "",
      }))
      .sort(byDepartment),
    // Definition fields are the risk's own; the period's rating is "—".
    ...notInPeriod
      .map((r) => ({
        id: r.id,
        process: r.processName,
        risk: r.title,
        dept: r.departmentCode,
        ref: ref(r.referenceNumber),
        ls: "—",
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
        owner: r.ownerTitle ?? "",
        affected_assets: r.affectedAssets,
        threat: r.threat ?? "",
        vulnerability: r.vulnerability ?? "",
        treatment: r.treatment ?? "",
      }))
      .sort(byDepartment),
  ];

  return {
    ok: true,
    title: `Risks · ${p.quarter} ${p.year}`,
    exportedAt: new Date().toISOString(),
    exportedBy: user.fullName,
    columns: fileColumns,
    rows: rows.map((r) => pickColumns(r, fileColumns)),
  };
}
