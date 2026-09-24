"use client"

import { ChevronUp, Download, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { ExportFormat } from "@/lib/export/download"

/**
 * The floating bar a list shows while rows are ticked.
 *
 * Sticky to the bottom of the page container rather than fixed to the
 * viewport, so it centres on the content area and not on content plus
 * sidebar. Render it as the container's last child. It renders nothing at
 * zero, so the caller does not have to.
 *
 * `onExport` is optional so the bar can land before any export does; with
 * none, there is no Export button to press and have nothing happen.
 */
export default function SelectionBar({
  count,
  singular,
  plural,
  onExport,
  exporting = false,
  onClear,
}: {
  count: number
  /** "KPI", "risk" */
  singular: string
  /** "KPIs", "risks" */
  plural: string
  onExport?: (format: ExportFormat) => void
  /** An export is being built; the button says so and will not start another. */
  exporting?: boolean
  onClear: () => void
}) {
  if (count === 0) return null

  return (
    <div className="pointer-events-none sticky bottom-6 z-30 flex justify-center">
      <div
        role="region"
        aria-label="Selection"
        className="pointer-events-auto flex items-center gap-4 rounded-xl bg-[#0f172a] py-2 pl-5 pr-2 text-sm text-white shadow-2xl shadow-slate-900/30"
      >
        <span className="font-medium tabular-nums" aria-live="polite">
          {count} {count === 1 ? singular : plural} selected
        </span>

        <div className="flex items-center gap-1">
          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={exporting}
                className="inline-flex h-8 items-center gap-1.5 rounded-md bg-white px-3 text-sm font-medium text-[#0f172a] outline-none transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-70"
              >
                <Download className="h-4 w-4" />
                {exporting ? "Exporting…" : "Export"}
                <ChevronUp className="h-3.5 w-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="end" sideOffset={8} className="w-40">
                <DropdownMenuItem onClick={() => onExport("xlsx")}>Excel (.xlsx)</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport("pdf")}>PDF</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          <button
            type="button"
            aria-label="Clear selection"
            onClick={onClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-300 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
