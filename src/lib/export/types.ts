import type { ExportColumn } from "./download";

/**
 * What an export server action hands the browser: the rows, the columns to
 * write them under, and the header lines the file opens with. The file itself is built client-side from
 * this, so the action stays independent of any page and of the format.
 */
export type TableExport<Row> = {
  /** "KPIs · Q2 2026" */
  title: string;
  /** ISO timestamp, taken on the server when the rows were read. */
  exportedAt: string;
  /** The signed-in user's full name. */
  exportedBy: string;
  /** In file order: built from the chosen columns by the action. */
  columns: ExportColumn<Row>[];
  rows: Row[];
};

export type ExportResult<Row> =
  | ({ ok: true } & TableExport<Row>)
  | { ok: false; message: string };
