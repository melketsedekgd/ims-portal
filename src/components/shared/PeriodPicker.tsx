"use client"

import { useRouter } from "next/navigation"
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
 */
export default function PeriodPicker({ year, quarter }: { year: string; quarter: string }) {
  const router = useRouter()

  const push = (next: { year?: string; quarter?: string }) => {
    const params = new URLSearchParams({
      year: next.year ?? year,
      quarter: next.quarter ?? quarter,
    })
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <div
        role="group"
        aria-label="Quarter"
        className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white p-0.5"
      >
        {QUARTERS.map((q) => {
          const selected = q === quarter
          return (
            <button
              key={q}
              type="button"
              aria-pressed={selected}
              onClick={() => push({ quarter: q })}
              className={`h-full rounded-[5px] px-3 text-sm font-medium transition-colors ${
                selected
                  ? "bg-ink text-white"
                  : "text-slate-600 hover:bg-slate-100 hover:text-ink"
              }`}
            >
              {q}
            </button>
          )
        })}
      </div>
      <Select value={year} onValueChange={(v) => v && push({ year: v })}>
        <SelectTrigger aria-label="Year" className="w-[92px] h-9 text-sm bg-white border-slate-200">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map((y) => (
            <SelectItem key={y} value={y}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
