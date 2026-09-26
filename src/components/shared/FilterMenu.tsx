"use client"

import { Filter } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuGroup,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu"
import type { FilterOption } from "@/components/shared/FilterChips"

export type FilterCategory<V extends string = string> = {
  id: string
  label: string
  options: FilterOption<V>[]
  selected: V[]
  onChange: (next: V[]) => void
}

/**
 * Enterprise nested filter dropdown.
 * Renders a single `[ Filter ]` button that opens a menu containing nested
 * category submenus (e.g. Status, Responsibility, Score Band).
 */
export default function FilterMenu({
  categories,
  onClearAll,
}: {
  categories: FilterCategory<any>[]
  onClearAll?: () => void
}) {
  const totalActive = categories.reduce((sum, c) => sum + c.selected.length, 0)

  const clearAll = () => {
    categories.forEach((c) => c.onChange([]))
    onClearAll?.()
  }

  const toggle = (category: FilterCategory<any>, value: string) => {
    category.onChange(
      category.selected.includes(value)
        ? category.selected.filter((v: string) => v !== value)
        : [...category.selected, value]
    )
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            buttonVariants({ variant: "outline" }),
            "h-9 gap-2 text-sm bg-white border-slate-200 dark:bg-slate-950 dark:border-slate-800"
          )}
        >
          <Filter className="h-4 w-4" />
          Filter
          {totalActive > 0 && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <span className="flex h-5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                {totalActive}
              </span>
            </>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[180px]">
          <DropdownMenuGroup>
            <DropdownMenuLabel>Filter by</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {categories.map((cat) => (
              <DropdownMenuSub key={cat.id}>
                <DropdownMenuSubTrigger className="cursor-pointer">
                  <span className="flex-1 text-left">{cat.label}</span>
                  {cat.selected.length > 0 && (
                    <span className="mr-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 px-1.5 text-[10px] font-bold text-slate-800 dark:text-slate-200">
                      {cat.selected.length}
                    </span>
                  )}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[220px]">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>{cat.label}</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {cat.options.map((opt) => {
                      const active = cat.selected.includes(opt.value)
                      const disabled = opt.count === 0 && !active
                      return (
                        <DropdownMenuCheckboxItem
                          key={opt.value}
                          checked={active}
                          disabled={disabled}
                          onCheckedChange={() => toggle(cat, opt.value)}
                        >
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <span className="truncate">{opt.label}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {opt.count}
                            </span>
                          </div>
                        </DropdownMenuCheckboxItem>
                      )
                    })}
                  </DropdownMenuGroup>
                  {cat.selected.length > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="justify-center text-center text-xs font-medium cursor-pointer"
                        onClick={() => cat.onChange([])}
                      >
                        Clear {cat.label.toLowerCase()}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            ))}
          </DropdownMenuGroup>
          {totalActive > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="justify-center text-center text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground"
                onClick={clearAll}
              >
                Clear all filters
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
