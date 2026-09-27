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

/**
 * Header patterns per field, most specific first. A header that names
 * something else — "KPI target", "Actual %" of achievement — is kept off
 * kpi_name and actual by the exclusions.
 */
const SUGGEST: Record<"kpi_name" | "actual" | "remark" | "evidence", { hit: RegExp[]; not?: RegExp }> = {
  kpi_name: {
    hit: [/^kpis?$/, /\bkpi\b|\bkpis\b/, /indicator|metric/],
    not: /target|actual|result|status|remark|evidence|owner|respons|unit|frequen|method|source|%|achiev|no\.?$|#/,
  },
  actual: {
    hit: [/^actual$/, /^actual\b|\bactual$/, /\bactual\b/, /result/, /achieved/],
    not: /target|%|rate|ratio|status|remark/,
  },
  remark: { hit: [/remark|justification|comment/, /\bnotes?\b|reason/] },
  evidence: { hit: [/evidence/, /reference|proof|attachment/] },
};

/**
 * A first guess at which header holds each field, from the header text.
 * Headers are the display names; returned values are display names too.
 * A header is used for at most one field.
 */
export function suggestColumns(headers: readonly string[]): Partial<Record<keyof typeof SUGGEST, string>> {
  const taken = new Set<string>();
  const out: Partial<Record<keyof typeof SUGGEST, string>> = {};
  for (const field of Object.keys(SUGGEST) as (keyof typeof SUGGEST)[]) {
    const { hit, not } = SUGGEST[field];
    for (const re of hit) {
      const found = headers.find((h) => {
        const n = normaliseHeader(h);
        return !taken.has(h) && re.test(n) && !(not && not.test(n));
      });
      if (found) {
        out[field] = found;
        taken.add(found);
        break;
      }
    }
  }
  return out;
}

/** Same header names, ignoring order, spacing and case. */
export function sameHeaders(a: readonly string[], b: readonly string[]): boolean {
  const x = new Set(a.map(normaliseHeader));
  const y = new Set(b.map(normaliseHeader));
  return x.size === y.size && [...x].every((h) => y.has(h));
}
