"use client"

import { SearchX } from "lucide-react"
import { Button } from "@/components/ui/button"

export type FilterOption<V extends string = string> = {
  value: V
  label: string
  /** How many rows carry this value in the FULL set, before any filter. */
  count: number
}

/**
 * Multi-select filter chips over values the query layer already assigned.
 *
 * The selection lives in the caller's component state, never the URL. The
 * period decides what is fetched; these only hide rows already in memory
 * and already scoped by RLS. A round trip to hide rows the client holds
 * would be waste, and a useState period was the 9 September bug — the two
 * must not be confused. Do not move this into the URL.
 *
 * Counts come from the unfiltered rows, so they never move as the user
 * toggles chips: they say what exists in the period. A zero-count chip is
 * rendered disabled rather than hidden — "0 Deviated" is information, a
 * missing chip is ambiguity. An empty selection means no filter, not
 * "show nothing".
 */
export default function FilterChips<V extends string>({
  options,
  selected,
  onChange,
  label = "Filter",
}: {
  options: FilterOption<V>[]
  selected: V[]
  onChange: (next: V[]) => void
  /** Accessible name for the group. */
  label?: string
}) {
  const none = selected.length === 0

  const toggle = (value: V) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )

  return (
    <div role="group" aria-label={label} className="flex flex-wrap items-center gap-1.5">
      <Chip active={none} onClick={() => onChange([])} aria-pressed={none}>
        All
      </Chip>
      {options.map((o) => {
        const active = selected.includes(o.value)
        // Selected-but-zero cannot happen from this control, but a caller
        // could pass it; keep such a chip enabled so it can be cleared.
        const disabled = o.count === 0 && !active
        return (
          <Chip
            key={o.value}
            active={active}
            disabled={disabled}
            aria-pressed={active}
            onClick={() => toggle(o.value)}
          >
            <span className="tabular-nums">{o.count}</span> {o.label}
          </Chip>
        )
      })}
    </div>
  )
}

function Chip({
  active,
  disabled,
  children,
  ...rest
}: {
  active: boolean
  disabled?: boolean
  children: React.ReactNode
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={[
        "inline-flex items-center gap-1 rounded-full border px-2.5 h-7 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        active
          ? "border-blue-600 bg-blue-600 text-white dark:border-blue-500 dark:bg-blue-500"
          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900",
        "disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white dark:disabled:hover:bg-zinc-950",
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  )
}

/**
 * Count rows per catalogue value, in catalogue order, from the FULL row
 * set. Every catalogue value gets an entry even at zero.
 */
export function countBy<V extends string, R>(
  rows: R[],
  catalogue: { value: V; label: string }[],
  valueOf: (row: R) => V
): FilterOption<V>[] {
  const counts = new Map<V, number>()
  for (const row of rows) {
    const v = valueOf(row)
    counts.set(v, (counts.get(v) ?? 0) + 1)
  }
  return catalogue.map((c) => ({ ...c, count: counts.get(c.value) ?? 0 }))
}

/**
 * The empty state for "a filter hid every row". Deliberately not the same
 * component as a period with nothing in it: a filter that matches nothing
 * and a quarter with nothing recorded are different facts, and collapsing
 * them is the same class of mistake as Not Measured rendering as Pending.
 */
export function FilterEmptyState({
  noun,
  onClear,
}: {
  /** Plural noun for the rows: "KPIs", "risks", "objectives". */
  noun: string
  onClear: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center space-y-2 py-6">
      <SearchX className="h-8 w-8 text-muted-foreground/50" />
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
        No {noun} match this filter
      </p>
      <p className="text-xs text-muted-foreground max-w-sm">
        The {noun} for this period are still here; the filter hides all of them.
      </p>
      <Button variant="outline" size="sm" className="mt-2 text-xs" onClick={onClear}>
        Clear filter
      </Button>
    </div>
  )
}
