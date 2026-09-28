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

/**
 * A data row; selected rows take a light coral tint. `clickable` false for
 * a row that opens nothing, so it does not show the pointer.
 */
export function listRow(selected: boolean, clickable = true): string {
  return `h-12 ${clickable ? "cursor-pointer " : ""}border-ink/5 transition-colors ${
    selected ? "bg-coral-tint/70 hover:bg-coral-tint/70" : "hover:bg-ink/[0.03]"
  }`
}

/** Added to listRow() for a row that can no longer be edited: achieved or retired. */
export const LIST_ROW_LOCKED = "bg-ink/[0.02] opacity-80"

/**
 * A list's text button: the columns strip's Edit, and every list's Filter.
 * Coral-600 text, no fill until a coral-tint hover, 32px to the eye; the
 * ::before takes the tap area to 44px, so give the element data-hit-area
 * to keep the global mobile rule from growing the box.
 */
export const LIST_TEXT_BUTTON =
  "relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-sm font-medium text-coral-600 transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-coral-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral-600"

/** A small count or value inside a LIST_TEXT_BUTTON: how many filters are on, or which. */
export const LIST_TEXT_BUTTON_BADGE =
  "flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-coral-600 px-1.5 text-[11px] font-semibold text-white tabular-nums"

/**
 * A list toolbar's buttons, on every table: Filter, the columns strip's
 * Edit, and the pager's page size, Previous and Next. A 36px text pill:
 * transparent at rest, ink text and icons at semibold, ink at 7% behind it
 * on hover, 35% opacity and inert when disabled. The 1px border is
 * transparent — there so a trigger's own border never shifts the size.
 * The ::before takes the tap area to 44px, so give the element
 * data-hit-area to keep the global mobile rule from growing the box.
 *
 * With no fill or border, the focus ring is the only focus cue: 2px of ink
 * at 40%, offset 2px. A ring, not an outline: the Select trigger sets
 * outline-none. [&_svg] beats an icon's own text colour (the Select's
 * muted chevron). Only the lists' toolbars take this; the Button
 * component is unchanged.
 */
const TOOLBAR_BUTTON_BASE =
  "relative inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border border-transparent bg-transparent text-sm font-semibold text-ink outline-none transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-ink/[0.07] focus-visible:border-transparent focus-visible:ring-2 focus-visible:ring-ink/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:pointer-events-none disabled:opacity-35 [&_svg]:text-ink"

export const LIST_TOOLBAR_BUTTON = `${TOOLBAR_BUTTON_BASE} px-3.5`

/** The same, square: the pager's Previous and Next. */
export const LIST_TOOLBAR_ICON_BUTTON = `${TOOLBAR_BUTTON_BASE} w-9`
