"use client"

import { Pencil } from "lucide-react"
import { Popover } from "@base-ui/react/popover"
import {
  PRESETS,
  matchingPreset,
  toggleColumn,
  type ColumnDef,
  type ColumnRegistry,
} from "@/lib/columns"

/**
 * The strip across the top of a list's card: how many columns are shown,
 * and Edit, which opens the Columns panel. It sits above the table's own
 * scroll container, so Edit stays put when a wide table scrolls sideways.
 *
 * Pure UI: the choice and what happens to it belong to the caller.
 */
export default function ColumnsBar<K extends string>({
  registry,
  keys,
  listed,
  onChange,
  onReset,
}: {
  registry: ColumnRegistry<K>
  keys: readonly K[]
  /** Whether a column is offered in the panel (Dept is not, to someone who sees one department). */
  listed: (key: K) => boolean
  onChange: (keys: K[]) => void
  onReset: () => void
}) {
  const offered = registry.columns.filter((c) => listed(c.key))
  const shown = offered.filter((c) => keys.includes(c.key)).length
  const active = matchingPreset(registry, keys)

  const main = offered.filter((c) => !c.extra)
  const extras = offered.filter((c) => c.extra)

  const row = (c: ColumnDef<K>) => (
    <label
      key={c.key}
      className={`flex h-11 items-center gap-3 px-3 text-sm ${c.locked ? "cursor-default" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900"}`}
    >
      <input
        type="checkbox"
        data-hit-area
        checked={c.locked || keys.includes(c.key)}
        disabled={c.locked}
        onChange={(e) => onChange(toggleColumn(registry, keys, c.key, e.target.checked))}
        className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-slate-900 disabled:cursor-default disabled:opacity-60"
      />
      <span className="flex-1 truncate">{c.label}</span>
      {c.locked ? (
        <span className="text-xs text-muted-foreground">Always shown</span>
      ) : c.note ? (
        <span className="text-right text-xs leading-tight text-muted-foreground">{c.note}</span>
      ) : null}
    </label>
  )

  return (
    <div className="flex h-11 items-center justify-between gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
      <span className="text-[13px] text-muted-foreground tabular-nums">
        {shown} of {offered.length} columns shown
      </span>

      <Popover.Root>
        {/* 32px to the eye; the ::before takes the tap area to 44px, and
            data-hit-area keeps the global mobile rule from growing the box. */}
        <Popover.Trigger
          data-hit-area
          aria-label="Edit columns"
          className="relative inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 text-sm font-medium text-ink-2 transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900"
        >
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </Popover.Trigger>

        {/* Base UI directly rather than components/ui/popover: that wrapper
            does not pass collisionAvoidance through. The panel is taller
            than the room under Edit on most screens, and the default flips
            it beside the button; here it stays below, right-aligned, only
            nudged sideways to fit a phone, and scrolls within the space. */}
        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            align="end"
            sideOffset={6}
            collisionPadding={8}
            collisionAvoidance={{ side: "none", align: "shift", fallbackAxisSide: "none" }}
            className="isolate z-50"
          >
            <Popover.Popup className="flex max-h-(--available-height) w-[320px] max-w-[calc(100vw-1rem)] origin-(--transform-origin) flex-col overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95">
              <div className="space-y-3 border-b border-slate-200 p-3 dark:border-slate-800">
                <Popover.Title className="text-sm font-semibold">Columns</Popover.Title>
                {/* Highlighted only when the set is exactly that preset; a
                    custom set highlights none. */}
                <div role="group" aria-label="Column presets" className="grid grid-cols-3 gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                  {PRESETS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      data-hit-area
                      aria-pressed={active === p.value}
                      onClick={() => onChange([...registry.presets[p.value]])}
                      className={`relative h-8 rounded-md text-sm font-medium transition-colors before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] ${
                        active === p.value
                          ? "bg-white text-ink shadow-sm dark:bg-slate-950"
                          : "text-slate-500 hover:text-ink"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="py-1">{main.map(row)}</div>

              {extras.length > 0 && (
                <div className="border-t border-slate-200 py-1 dark:border-slate-800">
                  <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    More details
                  </p>
                  {extras.map(row)}
                </div>
              )}

              <div className="flex h-11 items-center justify-between border-t border-slate-200 px-3 dark:border-slate-800">
                <span className="text-xs text-muted-foreground">Saved to your account</span>
                <button
                  type="button"
                  data-hit-area
                  onClick={onReset}
                  className="-mr-2 h-11 px-2 text-sm font-medium text-ink-2 underline-offset-4 hover:underline"
                >
                  Reset to default
                </button>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
