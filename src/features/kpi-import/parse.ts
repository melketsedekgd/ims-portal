"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { parseActual } from "@/features/kpis/parse-actual";
import { guessHeaderRow } from "./headers";
import { kpiIndex } from "./match";
import { guessPercentScale, normaliseName, type PercentScale } from "./review";
import { loadWorkbook, MAX_FILE_BYTES, readRows, topRows } from "./sheet";

/** Rows shown for choosing the header row. The real Q2 IT report's is row 8. */
const PREVIEW_ROWS = 30;
/** Data rows sent back for the mapping step's preview. */
const SAMPLE_ROWS = 5;

export type WorkbookRead = {
  sheets: string[];
  sheet: string;
  /** The row the headers are read from: the one asked for, else the guess. */
  headerRow: number;
  suggestedHeaderRow: number;
  /** The sheet's first rows as display text, for picking the header row. */
  top: string[][];
  headers: string[];
  sample: string[][];
  /** Non-blank rows below the header row. */
  dataRowCount: number;
};

export type ReadWorkbookResult =
  | { ok: true; data: WorkbookRead }
  | { ok: false; message: string };

/**
 * Parse an uploaded report: its sheet names, and for one sheet the rows
 * around its header row.
 *
 * FormData: `file`, and optionally `sheet` and `headerRow`. Without a sheet,
 * the first one whose name mentions KPI, else the first. Without a header
 * row, guessHeaderRow's. The wizard calls this again with the same file
 * whenever the sheet or header row changes — the file is never stored, so
 * each call parses it afresh. stageImport reads the rows the same way.
 */
export async function readWorkbook(formData: FormData): Promise<ReadWorkbookResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be signed in to import results." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose an Excel file to upload." };
  }
  if (file.size > MAX_FILE_BYTES) {
    return { ok: false, message: "That file is over 7 MB. Save a copy with only the KPI sheet." };
  }

  let wb;
  try {
    wb = await loadWorkbook(file);
  } catch {
    return { ok: false, message: "That file could not be read as an .xlsx workbook." };
  }

  const sheets = wb.worksheets.map((ws) => ws.name);
  if (sheets.length === 0) return { ok: false, message: "The workbook has no sheets." };

  const asked = formData.get("sheet");
  const ws =
    (typeof asked === "string" && asked ? wb.getWorksheet(asked) : undefined) ??
    wb.worksheets.find((s) => /kpi/i.test(s.name)) ??
    wb.worksheets[0];

  const top = topRows(ws, PREVIEW_ROWS);
  const suggestedHeaderRow = guessHeaderRow(top);
  const askedRow = Number(formData.get("headerRow"));
  const headerRow =
    Number.isInteger(askedRow) && askedRow >= 1 && askedRow <= Math.max(ws.rowCount, 1)
      ? askedRow
      : suggestedHeaderRow;

  const { headers, rows } = readRows(ws, headerRow);

  return {
    ok: true,
    data: {
      sheets,
      sheet: ws.name,
      headerRow,
      suggestedHeaderRow,
      top,
      headers,
      sample: rows.slice(0, SAMPLE_ROWS).map((r) => r.cells),
      dataRowCount: rows.length,
    },
  };
}

export type PercentScaleGuess = {
  scale: PercentScale;
  /** Bare values between 0 and 1, and above 1, in percentage KPIs' rows. */
  fraction: number;
  whole: number;
};

/**
 * How this file writes bare percentages, for pre-filling the mapping step's
 * choice. Looks at rows whose name matches one of the department's
 * percentage KPIs and whose result is a bare number — "97.29%" and cells
 * formatted as % carry their own unit and are not counted.
 *
 * FormData: `file`, `sheet`, `headerRow`, `departmentId`, and the display
 * header names `kpiColumn` and `actualColumn`.
 */
export async function readPercentScale(
  formData: FormData
): Promise<{ ok: true; guess: PercentScaleGuess } | { ok: false; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "You must be signed in to import results." };

  const file = formData.get("file");
  const departmentId = String(formData.get("departmentId") ?? "");
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES || !z.uuid().safeParse(departmentId).success) {
    return { ok: false, message: "Nothing to read." };
  }

  let sheet;
  try {
    const ws = (await loadWorkbook(file)).getWorksheet(String(formData.get("sheet") ?? ""));
    if (!ws) return { ok: false, message: "That sheet is not in the file." };
    sheet = readRows(ws, Number(formData.get("headerRow")) || 1);
  } catch {
    return { ok: false, message: "That file could not be read as an .xlsx workbook." };
  }
  const iName = sheet.headers.indexOf(String(formData.get("kpiColumn") ?? ""));
  const iActual = sheet.headers.indexOf(String(formData.get("actualColumn") ?? ""));
  if (iName < 0 || iActual < 0) return { ok: true, guess: { scale: "whole", fraction: 0, whole: 0 } };

  const byName = await kpiIndex(departmentId);
  const values: number[] = [];
  for (const r of sheet.rows) {
    const matches = byName.get(normaliseName(r.cells[iName] ?? "")) ?? [];
    if (matches.length !== 1 || matches[0].target_unit !== "percent") continue;
    const v = parseActual(r.cells[iActual] ?? "");
    if (v.kind === "value" && v.unit === null) values.push(v.value);
  }
  return { ok: true, guess: guessPercentScale(values) };
}
