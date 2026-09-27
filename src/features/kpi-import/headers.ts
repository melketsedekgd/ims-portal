/**
 * Pure helpers for reading a report's header row. No client or server
 * imports, so the parser action and the wizard share one definition.
 */

/** How a header is compared: trimmed, whitespace collapsed, lower case. */
export function normaliseHeader(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/** "A", "B", … "AA" for a 1-based column number. */
export function columnLetter(n: number): string {
  let s = "";
  for (let c = n; c > 0; c = Math.floor((c - 1) / 26)) {
    s = String.fromCharCode(65 + ((c - 1) % 26)) + s;
  }
  return s;
}

/**
 * The header row's cells as column names, one per column. A blank cell
 * becomes "Column F"; a repeated name (a header merged across two columns
 * reads the same in both) gets " (2)", " (3)" so every column can be told
 * apart in the mapping step.
 */
export function headerNames(cells: readonly string[]): string[] {
  const seen = new Map<string, number>();
  return cells.map((cell, i) => {
    const base = cell.replace(/\s+/g, " ").trim() || `Column ${columnLetter(i + 1)}`;
    const n = (seen.get(normaliseHeader(base)) ?? 0) + 1;
    seen.set(normaliseHeader(base), n);
    return n === 1 ? base : `${base} (${n})`;
  });
}

const HEADER_WORDS = /\b(kpi|indicator|metric|target|actual|result|remark|evidence|process)/i;
const NUMBER = /^[-+]?[\d,.]+%?$/;

/**
 * The 1-based number of the first row that looks like a header row, among
 * the rows given: at least three different text cells, none of them a bare
 * number. A title merged across the sheet repeats one value in every cell,
 * so counting distinct values keeps it from qualifying. A row that also
 * names a KPI-ish column wins over one that merely qualifies — the real Q2
 * IT report has metadata rows above its headers on row 8.
 */
export function guessHeaderRow(rows: readonly (readonly string[])[]): number {
  let firstPlausible = 0;
  for (let i = 0; i < rows.length; i++) {
    const values = rows[i].map((c) => c.trim()).filter(Boolean);
    const distinct = new Set(values.map(normaliseHeader));
    if (distinct.size < 3 || values.some((v) => NUMBER.test(v))) continue;
    if (values.some((v) => HEADER_WORDS.test(v))) return i + 1;
    if (!firstPlausible) firstPlausible = i + 1;
  }
  return firstPlausible || 1;
}
