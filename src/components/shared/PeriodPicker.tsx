"use client"

import { useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const

/**
 * Segmented Q1–Q4 plus a year select.
 *
 * Holds no period state. The period lives in the URL (`?year=&quarter=`)
 * and the server component re-runs on it; this only pushes the next URL.
 * A period held in component state here once pinned the KPI page to one quarter while
 * every check passed — do not add one.
 *
 * A lock on closed quarters would need reporting_periods.status for all
 * four, which is a query; follow-up, not here.
 *
 * `years` comes from getReportingYears(), fetched by the page: this is a
 * client component and cannot query. The selected year is kept in the list
 * even when it has no periods (a hand-typed ?year=, or getCurrentPeriod's
 * calendar fallback) so the trigger still shows what the page is showing.
 */
export default function PeriodPicker({
  year,
  quarter,
  years,
}: {
  year: string
  quarter: string
  years: number[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const options = years.map(String)
  if (!options.includes(year)) {
    options.push(year)
    options.sort((a, b) => Number(b) - Number(a))
  }

  // Built from the current URL rather than from scratch: year and quarter
  // are the only two this owns, and anything else in the URL belongs to
  // whoever put it there. Rebuilding it from scratch dropped the IMS
  // dashboard's ?dept= on every quarter click, which read as the view
  // resetting itself. The three list pages carry the same ?dept= for IMS
  // (DepartmentFilter) and rely on it surviving a quarter change too.
  // The one exception is the risk map's ?ls: a square picked in Q2 is not
  // a question about Q3, so a period change clears it.
  const push = (next: { year?: string; quarter?: string }) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("ls")
    params.set("year", next.year ?? year)
    params.set("quarter", next.quarter ?? quarter)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={quarter} onValueChange={(v) => v && push({ quarter: v })}>
        <SelectTrigger aria-label="Quarter" className="w-[84px] h-9 text-sm bg-white border-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {QUARTERS.map((q) => (
            <SelectItem key={q} value={q}>{q}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={year} onValueChange={(v) => v && push({ year: v })}>
        <SelectTrigger aria-label="Year" className="w-[92px] h-9 text-sm bg-white border-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((y) => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
