"use client"

import { Plus } from "lucide-react"
import { SelectItem, SelectSeparator } from "@/components/ui/select"

/**
 * The value of the "+ Add …" entry at the end of a select. Never stored: the
 * select's onValueChange sees it, opens the dialog and leaves the current
 * value as it was. Not a uuid or a unit key, so it cannot collide with one.
 */
export const ADD_OPTION = "__add__"

/** "+ Add process…" / "+ Add unit…", last in a SelectContent. */
export function AddOptionItem({ label }: { label: string }) {
  return (
    <>
      <SelectSeparator />
      <SelectItem value={ADD_OPTION} className="text-primary">
        <Plus className="size-3.5" aria-hidden />
        {label}
      </SelectItem>
    </>
  )
}
