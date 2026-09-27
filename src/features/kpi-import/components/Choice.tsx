"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type ChoiceItem = { value: string; label: string }

/**
 * A labelled-by-its-caller select over a plain list. Base UI's Select.Value
 * renders the raw value unless Root is given `items`; both the trigger and
 * the popup read the same array here so they cannot drift.
 */
export default function Choice({
  id,
  value,
  onChange,
  items,
  placeholder,
  disabled,
  className,
}: {
  id?: string
  value: string
  onChange: (value: string) => void
  items: ChoiceItem[]
  placeholder?: string
  disabled?: boolean
  className?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => v !== null && onChange(v)}
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
      </SelectContent>
    </Select>
  )
}
