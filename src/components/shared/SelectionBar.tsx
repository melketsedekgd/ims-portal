"use client"

import { ChevronUp, Download, Share2, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import type { ExportFormat } from "@/lib/export/download"

/**
 * The floating bar a list shows while rows are ticked: a glass pill with
 * the count, Export, Share and a clear button, in ink on white glass
 * rather than the dark band it used to be.
 *
 * Fixed to the bottom of the viewport, above the iOS home indicator, so
 * it is in the same place on a short list as on a long one. It centres on
 * the content area, not content plus sidebar: from 768px its left edge is
 * the sidebar's width (the layout's --sidebar-width, or --sidebar-width-icon
 * while the rail is collapsed); below that the sidebar is a sheet and the
 * bar spans the screen.
 *
 * Render it as the page container's last child: alongside the bar it
 * renders a spacer the bar's height plus its gap, so the list's last rows
 * and its pagination can scroll clear of it. It renders nothing at zero,
 * so the caller does not have to.
 *
 * `onExport` is optional so the bar can land before any export does; with
 * none, there is no Export button to press and have nothing happen. The
 * same goes for `onShare`.
 */
export default function SelectionBar({
  count,
  singular,
  plural,
  onExport,
  exporting = false,
  onShare,
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
  onShare?: () => void
  onClear: () => void
}) {
  if (count === 0) return null

  return (
    <>
      {/* The bar's 46px (32px controls, 6px padding each side, 1px glass
          border each side) plus its 1.5rem gap. mt-0: the container's
          space-y would add its own gap on top. */}
      <div aria-hidden className="mt-0! h-[calc(2.875rem+1.5rem+env(safe-area-inset-bottom,0px))]" />
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] z-30 flex justify-center px-4 transition-[left] duration-200 ease-linear md:left-(--sidebar-width) md:group-has-[[data-slot=sidebar][data-state=collapsed]]/sidebar-wrapper:left-(--sidebar-width-icon)">
        <div
          role="region"
          aria-label="Selection"
          className="glass pointer-events-auto flex items-center gap-3 rounded-full py-1.5 pl-5 pr-1.5 text-sm text-ink shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
        >
          <span className="font-semibold tabular-nums" aria-live="polite">
            {count} {count === 1 ? singular : plural} selected
          </span>

          <span className="h-5 w-px bg-ink/10" aria-hidden />

          <div className="flex items-center gap-1">
            {onExport && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={exporting}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink outline-none transition-colors hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-coral-tint disabled:opacity-70"
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

            {onShare && (
              <button
                type="button"
                onClick={onShare}
                className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-ink outline-none transition-colors hover:bg-ink/5 focus-visible:ring-2 focus-visible:ring-coral-tint"
              >
                <Share2 className="h-4 w-4" />
                Share
              </button>
            )}

            {/* 32px to look at, 44px to tap: the ::before reaches into the
                bar's right padding and stops at the gap before Share. */}
            <button
              type="button"
              data-hit-area
              aria-label="Clear selection"
              onClick={onClear}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink/5 text-ink-2 outline-none transition-colors before:absolute before:-inset-y-1.5 before:-left-1 before:-right-2 hover:bg-ink/10 hover:text-ink focus-visible:ring-2 focus-visible:ring-coral-tint"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
