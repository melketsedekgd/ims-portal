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

// jsPDF's built-in fonts are WinAnsi only and print "≥" as garbage. These
// are Noto Sans with the arithmetic and arrow blocks merged in from Noto
// Sans Math — see scripts/fonts/build-pdf-fonts.py. Served from public/
// and fetched on the first PDF export, never part of the page bundle.
const PDF_FONT = "NotoSans";
const PDF_FONT_FILES = {
  normal: "/fonts/NotoSans-Regular.ttf",
  bold: "/fonts/NotoSans-Bold.ttf",
} as const;

type PdfFontStyle = keyof typeof PDF_FONT_FILES;

// jsPDF's virtual file system takes a font as a base64 string.
async function fetchBase64(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // In chunks: spreading ~470 kB into one fromCharCode call overflows the
  // argument limit.
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

// One download per page load, however many PDFs are exported. Cleared on
// failure so the next click retries rather than rethrowing a stale error.
let pdfFonts: Promise<Record<PdfFontStyle, string>> | null = null;

function loadPdfFonts(): Promise<Record<PdfFontStyle, string>> {
  pdfFonts ??= Promise.all([
    fetchBase64(PDF_FONT_FILES.normal),
    fetchBase64(PDF_FONT_FILES.bold),
  ]).then(
    ([normal, bold]) => ({ normal, bold }),
    (err) => {
      pdfFonts = null;
      throw err;
    }
  );
  return pdfFonts;
}

async function buildPdf<Row>(spec: ExportSpec<Row>): Promise<Blob> {
  // jspdf is ESM with named exports; jspdf-autotable exports autoTable as a
  // function taking the document, which needs no prototype patching.
  const [{ jsPDF }, { autoTable }, fonts] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
    loadPdfFonts(),
  ]);

  // Landscape: six or seven columns, two of them long text.
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const margin = 14;

  for (const style of ["normal", "bold"] as const) {
    const file = PDF_FONT_FILES[style].split("/").pop()!;
    doc.addFileToVFS(file, fonts[style]);
    doc.addFont(file, PDF_FONT, style);
  }

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42);
  doc.text(spec.title, margin, 18);

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(exportedLine(spec.exportedAt, spec.exportedBy), margin, 25);

  // The Excel widths, scaled to the printable width, so the two formats
  // give each column the same share.
  const printable = doc.internal.pageSize.getWidth() - margin * 2;
  const total = spec.columns.reduce((n, c) => n + c.width, 0);

  autoTable(doc, {
    startY: 31,
    margin: { left: margin, right: margin },
    head: [spec.columns.map((c) => c.header)],
    body: spec.rows.map((row) => spec.columns.map((c) => String(row[c.key] ?? ""))),
    columnStyles: Object.fromEntries(
      spec.columns.map((c, i) => [i, { cellWidth: (c.width / total) * printable }])
    ),
    styles: { font: PDF_FONT, fontSize: 9, cellPadding: 2, valign: "top" },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  return doc.output("blob");
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
      save(await buildPdf(spec), `${spec.fileName}.pdf`);
      return;
  }
}
