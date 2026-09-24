import type { TableExport } from "./types";

/**
 * Builds an export file in the browser and saves it.
 *
 * The libraries are loaded with import() at click time, never at the top of
 * the module: exceljs alone is several hundred kB, and nobody who opens a
 * list without exporting from it should download it. Everything the file
 * says comes from the server action's result; this only lays it out.
 */

export type ExportFormat = "xlsx" | "pdf";

export type ExportColumn<Row> = {
  header: string;
  key: keyof Row & string;
  /** Excel column width in characters. */
  width: number;
};

export type ExportSpec<Row> = TableExport<Row> & {
  columns: ExportColumn<Row>[];
  /** Without extension: "kpis-2026-Q2". */
  fileName: string;
};

/** "Exported 24 Sep 2026 by Jane Doe" */
export function exportedLine(exportedAt: string, exportedBy: string): string {
  const date = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(exportedAt));
  return `Exported ${date} by ${exportedBy}`;
}

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick: some browsers have not started the download
  // by the time click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

async function buildXlsx<Row>(spec: ExportSpec<Row>): Promise<Blob> {
  // exceljs is CommonJS/UMD. Depending on the bundler's interop its classes
  // arrive on the namespace or under `default`; take whichever is there.
  const mod = await import("exceljs");
  const { Workbook } = ("default" in mod ? mod.default : mod) as typeof import("exceljs");
  const wb = new Workbook();
  const ws = wb.addWorksheet(spec.title.split(" · ")[0] ?? "Export");

  ws.columns = spec.columns.map((c) => ({ key: c.key, width: c.width }));

  ws.addRow([spec.title]).font = { bold: true, size: 14 };
  ws.addRow([exportedLine(spec.exportedAt, spec.exportedBy)]).font = {
    color: { argb: "FF64748B" },
  };
  ws.addRow([]);

  const header = ws.addRow(spec.columns.map((c) => c.header));
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  });

  for (const row of spec.rows) {
    const r = ws.addRow(spec.columns.map((c) => String(row[c.key] ?? "")));
    r.alignment = { vertical: "top", wrapText: true };
  }

  // Header stays in view while scrolling a long export.
  ws.views = [{ state: "frozen", ySplit: header.number }];

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export async function downloadTable<Row>(
  spec: ExportSpec<Row>,
  format: ExportFormat
): Promise<void> {
  switch (format) {
    case "xlsx":
      save(await buildXlsx(spec), `${spec.fileName}.xlsx`);
      return;
    case "pdf":
      throw new Error("PDF export is not built yet.");
  }
}
