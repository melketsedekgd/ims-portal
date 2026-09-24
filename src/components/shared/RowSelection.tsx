"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"

/**
 * Ticked rows on a list page, by id.
 *
 * Held in a provider mounted from the list's layout, not in the list
 * component. The list is keyed by year-quarter so it remounts on a period
 * change, and anything it held in useState would go with it; the layout
 * stays mounted while only the search params change, so the selection
 * survives the period picker and the department filter. Leaving the
 * section unmounts the layout and clears it.
 *
 * Ids, not rows: a ticked row can be filtered out of view and must still
 * count, and the export fetches the rows fresh anyway.
 */
type RowSelection = {
  selected: ReadonlySet<string>
  toggle: (id: string) => void
  /** Ticks or unticks every id given, leaving the rest alone. */
  setMany: (ids: readonly string[], on: boolean) => void
  clear: () => void
}

const RowSelectionContext = createContext<RowSelection | null>(null)

export function RowSelectionProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const setMany = useCallback((ids: readonly string[], on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev)
      for (const id of ids) {
        if (on) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set()), [])

  const value = useMemo(
    () => ({ selected, toggle, setMany, clear }),
    [selected, toggle, setMany, clear]
  )

  return <RowSelectionContext.Provider value={value}>{children}</RowSelectionContext.Provider>
}

export function useRowSelection(): RowSelection {
  const ctx = useContext(RowSelectionContext)
  if (!ctx) throw new Error("useRowSelection needs a RowSelectionProvider above it (the list's layout.tsx)")
  return ctx
}

/**
 * A native checkbox: keyboard, focus and screen-reader behaviour for free,
 * and `indeterminate` for the header's "some but not all" state, which is
 * a DOM property with no attribute form — hence the ref.
 *
 * The box stays 16px; the label around it is the 44px tap area. Its padding
 * is cancelled by an equal negative margin, so the row does not grow, and
 * data-hit-area exempts the box from the global mobile 44px rule. The left
 * padding matches the lists' 16px (pl-4) in a 44px cell, so the area fills
 * that cell exactly instead of spilling under the next one.
 *
 * Clicks stop at the label, so a tap anywhere in that area never also
 * opens the row.
 */
export function SelectCheckbox({
  checked,
  indeterminate = false,
  onChange,
  label,
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className="-my-[14px] -ml-4 -mr-3 inline-flex cursor-pointer py-[14px] pl-4 pr-3 align-middle"
    >
      <input
        type="checkbox"
        data-hit-area
        aria-label={label}
        checked={checked}
        ref={(el) => {
          if (el) el.indeterminate = indeterminate
        }}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-slate-900"
      />
    </label>
  )
}
