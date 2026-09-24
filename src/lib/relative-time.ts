const DIVISIONS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["second", 60],
  ["minute", 60],
  ["hour", 24],
  ["day", 7],
  ["week", 4.34524],
  ["month", 12],
  ["year", Number.POSITIVE_INFINITY],
]

/** "3 minutes ago", "yesterday". In the runtime's locale and clock. */
export function relativeTime(iso: string): string {
  const format = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" })
  let delta = (new Date(iso).getTime() - Date.now()) / 1000
  for (const [unit, size] of DIVISIONS) {
    if (Math.abs(delta) < size) return format.format(Math.round(delta), unit)
    delta /= size
  }
  return ""
}
