"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * A link inside a CollapsibleCard header: follows the link without also
 * toggling the card.
 */
export function HeaderLink(props: React.ComponentProps<typeof Link>) {
  return <Link {...props} onClick={(e) => e.stopPropagation()} />
}

/**
 * A card whose header is the toggle; the body mounts only while open. The
 * header row takes the click and the chevron is the button, so the header
 * can hold links (a link inside a button is invalid HTML).
 */
export function CollapsibleCard({
  header,
  children,
}: {
  header: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border-2 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden">
      <div
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-4 p-5 text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50",
          open && "bg-slate-50 dark:bg-slate-900/50"
        )}
      >
        <div className="min-w-0 flex-1">{header}</div>
        {/* No handler of its own: the click reaches the row above. */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? "Collapse" : "Expand"}
          className="shrink-0 rounded-md cursor-pointer"
        >
          <ChevronDown
            className={cn("h-5 w-5 text-slate-600 transition-transform duration-150", open && "rotate-180")}
            aria-hidden
          />
        </button>
      </div>
      {open && <div className="px-5 pb-5 pt-4 space-y-4 border-t border-slate-100 dark:border-slate-800">{children}</div>}
    </div>
  )
}
