"use server";

import { createClient } from "@/lib/supabase/server";
import { guessHeaderRow } from "./headers";
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
