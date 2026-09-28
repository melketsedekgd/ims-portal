"use client"

import { useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LIST_TOOLBAR_BUTTON, LIST_TOOLBAR_ICON_BUTTON } from "@/components/shared/list-styles"
import { cn } from "@/lib/utils"

/**
 * Client-side pages for the grouped lists (KPIs, risks), applied after
 * every filter. Page and page size are component state, not the URL: a
 * page number is not something to link to, and the rows are all here.
 */

export const PAGE_SIZES = [10, 25, 50] as const
const DEFAULT_PAGE_SIZE = 25

export type Pagination = {
  /** 1-based, and always a page that exists. */
  page: number
  pageSize: number
  pageCount: number
  total: number
  /** The page's rows are [start, end) of the filtered rows. */
  start: number
  end: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

/**
 * `resetKey` is everything that changes which rows match — department,
 * period, filters, ?band, ?ls. When it changes the list goes back to page
 * 1. Compared during render rather than in an effect, so the stale page
 * is never painted.
 */
export function usePagination(total: number, resetKey: string): Pagination {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSizeState] = useState(DEFAULT_PAGE_SIZE)
  const [seenKey, setSeenKey] = useState(resetKey)
  if (seenKey !== resetKey) {
    setSeenKey(resetKey)
    setPage(1)
  }

  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  // The list can shrink under the page (a saved re-rating moves a row out
  // of the filter): show the last page, never an empty one.
  const current = Math.min(page, pageCount)
  const start = (current - 1) * pageSize

  return {
    page: current,
    pageSize,
    pageCount,
    total,
    start,
    end: Math.min(start + pageSize, total),
    setPage,
    setPageSize: (size) => {
      setPageSizeState(size)
      setPage(1)
    },
  }
}

export type PageGroup<T> = {
  name: string
  /** This page's rows of the group. */
  rows: T[]
  /** The group's filtered rows across all pages, for the header's count. */
  total: number
  /** The group began on an earlier page; its header is repeated here. */
  continued: boolean
}

/**
 * Rows in display order: grouped by `groupOf`, groups in first-seen order,
 * rows in their original order within a group. Filter after this, then
 * page with groupPage().
 */
export function orderByGroup<T>(rows: readonly T[], groupOf: (row: T) => string): T[] {
  const groups = new Map<string, T[]>()
  for (const row of rows) {
    const name = groupOf(row)
    const group = groups.get(name)
    if (group) group.push(row)
    else groups.set(name, [row])
  }
  return [...groups.values()].flat()
}

/**
 * One page of already-ordered, already-filtered rows, regrouped. A group
 * may split across pages; each page that holds any of it gets its header.
 */
export function groupPage<T>(
  rows: readonly T[],
  groupOf: (row: T) => string,
  start: number,
  end: number
): PageGroup<T>[] {
  const totals = new Map<string, number>()
  for (const row of rows) totals.set(groupOf(row), (totals.get(groupOf(row)) ?? 0) + 1)

  const page: PageGroup<T>[] = []
  for (let i = start; i < end; i++) {
    const row = rows[i]
    const name = groupOf(row)
    const last = page[page.length - 1]
    if (last?.name === name) {
      last.rows.push(row)
    } else {
      page.push({
        name,
        rows: [row],
        total: totals.get(name) ?? 0,
        continued: i > 0 && groupOf(rows[i - 1]) === name,
      })
    }
  }
  return page
}

// The lists' toolbar buttons: 36px ink pills, 44px to the finger. The
// Select trigger's own height and chevron colour are overridden to match.
const SIZE_TRIGGER = cn(LIST_TOOLBAR_BUTTON, "w-fit data-[size=default]:h-9 pr-3")

const SIZE_LABELS: Record<string, string> = Object.fromEntries(
  PAGE_SIZES.map((n) => [String(n), `${n} per page`])
)

// The dashboard's sticky top bar is 64px (TopHeader's h-16); the table's
// top lands 16px under it.
const SCROLL_OFFSET = 64 + 16

/**
 * Brings the top of the list's card into view after the reader changes
 * page — from the bottom of a 25-row page, the next one would otherwise
 * open on its last rows. Only from here: a filter that resets the page
 * leaves the scroll where the reader put it. Nothing moves when the top
 * is already on screen.
 */
function scrollToTop(target: HTMLElement | null) {
  if (!target) return
  const { top } = target.getBoundingClientRect()
  if (top >= SCROLL_OFFSET && top < window.innerHeight) return
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  window.scrollTo({ top: window.scrollY + top - SCROLL_OFFSET, behavior: reduce ? "auto" : "smooth" })
}

const COUNT = "text-[13px] text-muted-foreground tabular-nums"

/**
 * The strip under a list's table: "1–25 of 63", the page size, previous
 * and next. Renders nothing when every row fits on one page — unless the
 * list passes `summary`, a count of its own ("7 of 12 actions") to show
 * in the strip's place then. Opt-in: without it, nothing changes.
 *
 * `scrollTarget` is the list's card: a page change scrolls its top into view.
 */
export default function ListPagination({
  pager,
  scrollTarget,
  summary,
}: {
  pager: Pagination
  scrollTarget: React.RefObject<HTMLElement | null>
  summary?: React.ReactNode
}) {
  const { page, pageSize, pageCount, total, start, end } = pager
  if (total <= pageSize) {
    if (!summary) return null
    return (
      <p className={cn(COUNT, "border-t border-ink/8 py-2.5 pl-4 pr-2")} aria-live="polite">
        {summary}
      </p>
    )
  }

  const setPage = (next: number) => {
    pager.setPage(next)
    scrollToTop(scrollTarget.current)
  }
  const setPageSize = (size: number) => {
    pager.setPageSize(size)
    scrollToTop(scrollTarget.current)
  }

  return (
    <nav
      aria-label="Pages"
      className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-ink/8 py-2 pl-4 pr-2"
    >
      <span className={COUNT} aria-live="polite">
        {start + 1}–{end} of {total}
      </span>

      <div className="flex items-center gap-2">
        <Select
          items={SIZE_LABELS}
          value={String(pageSize)}
          onValueChange={(v) => v && setPageSize(Number(v))}
        >
          <SelectTrigger aria-label="Rows per page" data-hit-area className={SIZE_TRIGGER}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {SIZE_LABELS[String(n)]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          data-hit-area
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
          className={LIST_TOOLBAR_ICON_BUTTON}
        >
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </button>
        <button
          type="button"
          data-hit-area
          aria-label="Next page"
          disabled={page >= pageCount}
          onClick={() => setPage(page + 1)}
          className={LIST_TOOLBAR_ICON_BUTTON}
        >
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </nav>
  )
}
