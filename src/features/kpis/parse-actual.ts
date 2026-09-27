/**
 * Reads a result the way a quarterly report writes it — "131.54 ms",
 * "97.29%", "8hr 27 mins", "9 incidents", "N/A" — into a value and a unit
 * key from `units`. The only parser of its kind: the Excel import uses it,
 * and manual entry takes a bare number with the KPI's own unit.
 *
 * Pure, no client or server imports. It knows unit words, not KPIs: whether
 * a unit suits a KPI's target is the caller's question.
 */

export type ParsedActual =
  /** Nothing in the cell. */
  | { kind: "empty" }
  /** "N/A" and friends. Not a value of zero — see not_measured. */
  | { kind: "not_measured" }
  /** unit is a units.key, or null when the text names none. */
  | { kind: "value"; value: number; unit: string | null }
  /** Text that is not a number with a unit. */
  | { kind: "unparsed" }

const NOT_MEASURED = /^(n\s*\/\s*a|na|not\s+(measured|applicable))\.?$/i

/** Unit words → units.key. Case-insensitive; a trailing "." is dropped. */
const UNIT_WORDS: Record<string, string> = {
  "%": "percent", percent: "percent", pct: "percent",
  ms: "ms", msec: "ms", millisecond: "ms", milliseconds: "ms",
  s: "s", sec: "s", secs: "s", second: "s", seconds: "s",
  min: "min", mins: "min", minute: "min", minutes: "min",
  h: "hr", hr: "hr", hrs: "hr", hour: "hr", hours: "hr",
  d: "day", day: "day", days: "day",
  wk: "week", wks: "week", week: "week", weeks: "week",
  mo: "month", month: "month", months: "month",
  sp: "story_pt", pt: "story_pt", pts: "story_pt", point: "story_pt", points: "story_pt",
}

/** Seconds per unit, for adding up "8hr 27 mins". Months are too uneven to add. */
const SECONDS: Record<string, number> = {
  ms: 0.001, s: 1, min: 60, hr: 3600, day: 86400, week: 604800,
}

/** A number, then optionally a unit word or %. */
const PART = /(-?(?:\d{1,3}(?:,\d{3})+|\d+)?(?:\.\d+)?)\s*(%|[a-z]+\.?)?/giy

/** Four decimals, as numeric columns elsewhere are rounded. */
const round4 = (n: number) => Math.round(n * 1e4) / 1e4

function unitKey(word: string | undefined): string | null | undefined {
  if (!word) return null
  const w = word.toLowerCase().replace(/\.$/, "")
  // Any other word after a number names what was counted: "9 incidents".
  return UNIT_WORDS[w] ?? "count"
}

export function parseActual(input: string): ParsedActual {
  const text = input
    .replace(/\s+/g, " ")
    .trim()
    .replace(/story points?/i, "sp")
  if (!text) return { kind: "empty" }
  if (NOT_MEASURED.test(text)) return { kind: "not_measured" }

  const parts: { value: number; unit: string | null }[] = []
  PART.lastIndex = 0
  while (PART.lastIndex < text.length) {
    const start = PART.lastIndex
    const m = PART.exec(text)
    if (!m || !m[1] || m[1] === "-") return { kind: "unparsed" }
    const value = Number(m[1].replace(/,/g, ""))
    if (!Number.isFinite(value)) return { kind: "unparsed" }
    parts.push({ value, unit: unitKey(m[2]) ?? null })
    // Parts are separated by spaces only: "8hr 27 mins", not "8hr and 27".
    while (text[PART.lastIndex] === " ") PART.lastIndex++
    if (PART.lastIndex === start) return { kind: "unparsed" }
  }

  if (parts.length === 1) return { kind: "value", ...parts[0] }

  // Several parts must all be durations; they are added up in the largest
  // unit written: "8hr 27 mins" → 8.45 hr.
  if (parts.some((p) => !p.unit || !(p.unit in SECONDS))) return { kind: "unparsed" }
  const largest = parts.reduce((a, b) => (SECONDS[b.unit!] > SECONDS[a.unit!] ? b : a)).unit!
  const seconds = parts.reduce((sum, p) => sum + p.value * SECONDS[p.unit!], 0)
  return { kind: "value", value: round4(seconds / SECONDS[largest]), unit: largest }
}
