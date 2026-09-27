/**
 * affected_assets is one text column holding a comma-separated list, as on
 * the quarterly reports. The create form edits it as a list; these convert
 * between the two. Pure — imported by the server query and the client form.
 */

/**
 * Split on commas outside brackets, so "Network Devices (Firewall, Routers),
 * CCTV Camera" is two assets, not three. Each item is trimmed with its inner
 * whitespace collapsed; empty items are dropped. An unclosed bracket keeps
 * the rest of the text as one item — "Software(Os,Sage" is in the data.
 */
export function splitAssets(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let current = "";
  for (const ch of text) {
    if (ch === "(") depth++;
    else if (ch === ")") depth = Math.max(0, depth - 1);
    if (ch === "," && depth === 0) {
      items.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  items.push(current);
  return items.map((s) => s.replace(/\s+/g, " ").trim()).filter(Boolean);
}

/** The column's form: items joined with ", ". */
export function joinAssets(list: readonly string[]): string {
  return list.join(", ");
}

/**
 * Drop case-insensitive duplicates, keeping the first spelling seen, then
 * sort ignoring case.
 */
export function uniqueCaseInsensitive(list: readonly string[]): string[] {
  const seen = new Map<string, string>();
  for (const s of list) {
    const key = s.toLowerCase();
    if (!seen.has(key)) seen.set(key, s);
  }
  return [...seen.values()].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: "base" })
  );
}
