"use client"

import { createContext, useCallback, useContext, useMemo, useState } from "react"
import { resolveColumns, type ColumnRegistry } from "@/lib/columns"

/**
 * The columns a list table shows, for the signed-in user.
 *
 * Held in a provider mounted from the list's layout, not in the list: the
 * list is keyed by year-quarter and remounts on a period change, and a
 * choice kept in its state would be re-read from the server on every
 * remount — racing the save of a change made just before. The layout stays
 * mounted while only the search params change.
 */
type ColumnChoice = {
  keys: readonly string[]
  set: (keys: readonly string[]) => void
  reset: () => void
  /** Can read more than one department: whether Dept is offered in the panel. */
  multiDepartment: boolean
}

const ColumnChoiceContext = createContext<ColumnChoice | null>(null)

export function ColumnChoiceProvider({
  registry,
  multiDepartment,
  children,
}: {
  registry: ColumnRegistry<string>
  multiDepartment: boolean
  children: React.ReactNode
}) {
  const [keys, setKeys] = useState<readonly string[]>(() => resolveColumns(registry, null))

  const set = useCallback(
    (next: readonly string[]) => setKeys(resolveColumns(registry, next)),
    [registry]
  )
  const reset = useCallback(() => setKeys(resolveColumns(registry, null)), [registry])

  const value = useMemo(
    () => ({ keys, set, reset, multiDepartment }),
    [keys, set, reset, multiDepartment]
  )

  return <ColumnChoiceContext.Provider value={value}>{children}</ColumnChoiceContext.Provider>
}

/** The choice, typed by the registry the table renders from. */
export function useColumnChoice<K extends string>(registry: ColumnRegistry<K>) {
  const ctx = useContext(ColumnChoiceContext)
  if (!ctx) throw new Error("useColumnChoice needs a ColumnChoiceProvider above it (the list's layout.tsx)")
  return {
    ...ctx,
    // resolveColumns is what put them there; this only restores the type.
    keys: ctx.keys.filter((k): k is K => registry.columns.some((c) => c.key === k)),
    set: ctx.set as (keys: readonly K[]) => void,
  }
}
