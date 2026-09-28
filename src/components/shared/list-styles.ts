/**
 * The coral glass look for the grouped lists (KPIs, risks).
 *
 * One glass card holds the columns strip and the table; rows are grouped
 * by process under a small coral-tint chip rather than a grey band, and
 * rows are separated by a hairline, not a border. Classes only — the lists
 * keep their own markup, behaviour and column registries.
 */

/** The card round the columns strip and the table. min-w-0 so a wide table scrolls inside it. */
export const LIST_CARD = "glass min-w-0 overflow-hidden rounded-[22px]"

/** The header row: no fill, a hairline under it. */
export const LIST_HEAD_ROW = "border-ink/8 hover:bg-transparent"

/** A column heading: small, uppercase, muted. */
export const LIST_HEAD =
  "h-10 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"

/** A process group's header row: no band, just space above the chip. */
export const LIST_GROUP_ROW = "cursor-pointer select-none border-0 hover:bg-transparent"

/** The process name as a chip. coral-600 text on the tint, never plain coral. */
export const LIST_GROUP_CHIP =
  "inline-flex max-w-full items-center gap-1.5 rounded-full bg-coral-tint px-2.5 py-1 text-xs font-semibold text-coral-600"

/** A data row; selected rows take a light coral tint. */
export function listRow(selected: boolean): string {
  return `h-12 cursor-pointer border-ink/5 transition-colors ${
    selected ? "bg-coral-tint/70 hover:bg-coral-tint/70" : "hover:bg-ink/[0.03]"
  }`
}
