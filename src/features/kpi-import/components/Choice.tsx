"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ADD_OPTION, AddOptionItem } from "@/features/reference-data/components/AddOptionItem"

export type ChoiceItem = { value: string; label: string }

/**
 * A labelled-by-its-caller select over a plain list. Base UI's Select.Value
 * renders the raw value unless Root is given `items`; both the trigger and
 * the popup read the same array here so they cannot drift.
 *
 * With `onAdd`, a "+ Add …" entry ends the list; choosing it calls onAdd and
 * leaves the value unchanged.
 */
export default function Choice({
  id,
  value,
  onChange,
  items,
  placeholder,
  disabled,
  className,
  addLabel,
  onAdd,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  items: ChoiceItem[]
  placeholder?: string
  disabled?: boolean
  className?: string
  /** "Add unit…"; shown only together with onAdd. */
  addLabel?: string
  onAdd?: () => void
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => (v === ADD_OPTION ? onAdd?.() : v !== null && onChange(v))}
      items={items}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full bg-white dark:bg-slate-950", className)}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
        {onAdd && addLabel && <AddOptionItem label={addLabel} />}
      </SelectContent>
    </Select>
  )
}
