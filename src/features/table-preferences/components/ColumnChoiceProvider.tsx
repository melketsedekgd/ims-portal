"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { resolveColumns, type ColumnRegistry } from "@/lib/columns"
import { resetTableColumns, saveTableColumns } from "@/features/table-preferences/mutations"

/**
 * The columns a list table shows, for the signed-in user.
 *
 * Held in a provider mounted from the list's layout, not in the list: the
 * list is keyed by year-quarter and remounts on a period change, and a
 * choice kept in its state would be re-read from the server on every
 * remount — racing the save of a change made just before. The layout stays
 * mounted while only the search params change.
 *
 * The layout reads the saved choice on the server, so the first paint is
 * already the user's columns. Changes apply at once and are saved behind
 * them: debounced, one write at a time and in order, so a Reset and a
 * later change cannot land the wrong way round. A failed save leaves the
 * screen as it is and says so.
 */
type ColumnChoice = {
  keys: readonly string[]
  set: (keys: readonly string[]) => void
  reset: () => void
  /** Can read more than one department: whether Dept is offered in the panel. */
  multiDepartment: boolean
}

const ColumnChoiceContext = createContext<ColumnChoice | null>(null)

const SAVE_DELAY_MS = 500

export function ColumnChoiceProvider({
  registry,
  saved,
  multiDepartment,
  children,
}: {
  registry: ColumnRegistry<string>
  /** The user's saved keys, raw; null when nothing is saved (Default). */
  saved: string[] | null
  multiDepartment: boolean
  children: React.ReactNode
}) {
  const [keys, setKeys] = useState<readonly string[]>(() => resolveColumns(registry, saved))

  // Writes run one after another, in the order they were asked for.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const enqueue = useCallback((write: () => Promise<{ ok: boolean }>) => {
    queue.current = queue.current.then(async () => {
      try {
        if ((await write()).ok) return
      } catch {
        // Network failure: same message as a refused write.
      }
      toast.error("Your column choice couldn't be saved.")
    })
  }, [])

  // The change waiting out its debounce, so leaving the page can still send it.
  const pending = useRef<{ timer: ReturnType<typeof setTimeout>; keys: readonly string[] } | null>(null)
  const flush = useCallback(() => {
    if (!pending.current) return
    clearTimeout(pending.current.timer)
    const next = pending.current.keys
    pending.current = null
    enqueue(() => saveTableColumns(registry.tableKey, [...next]))
  }, [enqueue, registry.tableKey])

  const set = useCallback(
    (next: readonly string[]) => {
      const resolved = resolveColumns(registry, next)
      setKeys(resolved)
      if (pending.current) clearTimeout(pending.current.timer)
      pending.current = { timer: setTimeout(flush, SAVE_DELAY_MS), keys: resolved }
    },
    [registry, flush]
  )

  const reset = useCallback(() => {
    if (pending.current) clearTimeout(pending.current.timer)
    pending.current = null
    setKeys(resolveColumns(registry, null))
    enqueue(() => resetTableColumns(registry.tableKey))
  }, [registry, enqueue])

  // Leaving the section: send a change still inside its debounce rather
  // than drop it.
  useEffect(() => flush, [flush])

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
