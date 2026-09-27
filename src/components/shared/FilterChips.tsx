"use client"

import { SearchX, Filter } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup
} from "@/components/ui/dropdown-menu"

export type FilterOption<V extends string = string> = {
  value: V
  label: string
  /** How many rows carry this value in the FULL set, before any filter. */
  count: number
}

/**
 * Multi-select filter dropdown over values the query layer already assigned.
 */
export default function FilterChips<V extends string>({
  options,
  selected,
  onChange,
  label = "Filter",
  groupLabel = "Filter by",
}: {
  options: FilterOption<V>[]
  selected: V[]
  onChange: (next: V[]) => void
  /** Accessible name for the group. */
  label?: string
  /** Header label inside the dropdown menu. */
  groupLabel?: string
}) {
  const toggle = (value: V) =>
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    )

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger className={cn(buttonVariants({ variant: "outline" }), "h-9 gap-2 text-sm bg-white border-slate-200 dark:bg-slate-950 dark:border-slate-800")}>
          <Filter className="h-4 w-4" />
          {label}
          {selected.length > 0 && (
            <>
              <div className="mx-2 h-4 w-px bg-border" />
              <div className="flex gap-1">
                {selected.length > 2 ? (
                  <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{selected.length} selected</span>
                ) : (
                  options
                    .filter((o) => selected.includes(o.value))
                    .map((o) => (
                      <span key={o.value} className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">
                        {o.label}
                      </span>
                    ))
                )}
              </div>
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[200px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>{groupLabel}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {options.map((o) => {
              const active = selected.includes(o.value)
              // Selected-but-zero cannot happen from this control, but a caller
              // could pass it; keep such a chip enabled so it can be cleared.
              const disabled = o.count === 0 && !active
              return (
                <DropdownMenuCheckboxItem
                  key={o.value}
                  checked={active}
                  disabled={disabled}
                  onCheckedChange={() => toggle(o.value)}
                >
                  <div className="flex flex-1 items-center justify-between">
                    <span>{o.label}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{o.count}</span>
                  </div>
                </DropdownMenuCheckboxItem>
              )
            })}
          </DropdownMenuGroup>
          {selected.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="justify-center text-center text-xs font-medium cursor-pointer"
                onClick={() => onChange([])}
              >
                Clear filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
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
