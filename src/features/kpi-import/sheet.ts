import "server-only";
import ExcelJSModule from "exceljs";
import type { Cell, Workbook, Worksheet } from "exceljs";
import { headerNames } from "./headers";

// exceljs is CommonJS. Depending on the bundler's interop its classes arrive
// on the namespace or under `default`; see lib/export/download.ts.
const ExcelJS = (
  "default" in ExcelJSModule ? ExcelJSModule.default : ExcelJSModule
) as typeof import("exceljs");

/** Uploads above this are refused before exceljs sees them. See next.config.ts. */
export const MAX_FILE_BYTES = 7 * 1024 * 1024;

/** One data row below the header row, as display text per column. */
export type SheetRow = { rowNumber: number; cells: string[] };

/**
 * Read an uploaded .xlsx into memory. The file is parsed here and dropped;
 * nothing stores it — only rows staged from it reach the database.
 */
export async function loadWorkbook(file: File): Promise<Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return wb;
}

/** Drop the float noise of a percent cell: 0.9729 * 100 → 97.29, not 97.28999… */
const clean = (n: number) => String(Number(n.toPrecision(12)));

/**
 * A cell as the person reading the sheet sees it.
 *
 * Merged cells need nothing here: exceljs returns the merge's top-left value
 * for every cell in the range, so a Process column merged down carries its
 * value into each row. Percent-formatted numbers are the exception to
 * `cell.text`, which gives the stored 0.9729 rather than the 97.29% shown;
 * the % is put back so the value parser reads the unit the sheet displays.
 */
export function cellText(cell: Cell): string {
  const v = cell.value;
  if (v === null || v === undefined) return "";

  const number =
    typeof v === "number"
      ? v
      : typeof v === "object" && "result" in v && typeof v.result === "number"
        ? v.result
        : null;
  if (number !== null) {
    return cell.numFmt?.includes("%") ? `${clean(number * 100)}%` : clean(number);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 10);

  return cell.text.replace(/\s+/g, " ").trim();
}

function rowCells(ws: Worksheet, rowNumber: number, width: number): string[] {
  const row = ws.getRow(rowNumber);
  const cells: string[] = [];
  for (let c = 1; c <= width; c++) cells.push(cellText(row.getCell(c)));
  return cells;
}

/** The first `count` rows, for choosing the header row. */
export function topRows(ws: Worksheet, count: number): string[][] {
  const last = Math.min(ws.rowCount, count);
  const rows: string[][] = [];
  for (let r = 1; r <= last; r++) rows.push(rowCells(ws, r, ws.columnCount));
  return rows;
}

/**
 * The header row's column names and every non-blank row below it. Rows with
 * no text in any column are left out: a sheet's rowCount includes styled but
 * empty rows, which is how a 44-KPI report reads as a thousand rows.
 */
export function readRows(
  ws: Worksheet,
  headerRow: number
): { headers: string[]; rows: SheetRow[] } {
  const width = ws.columnCount;
  const headers = headerNames(rowCells(ws, headerRow, width));
  const rows: SheetRow[] = [];
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const cells = rowCells(ws, r, width);
    if (cells.some(Boolean)) rows.push({ rowNumber: r, cells });
  }
  return { headers, rows };
}
