"use client"

import { useMemo } from "react"
import { Calendar, Building2, CalendarDays, ArrowUpDown } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SortOption {
  value: string;
  label: string;
}

interface GlobalFiltersProps {
  onYearChange?: (value: string) => void;
  onDepartmentChange?: (value: string) => void;
  onQuarterChange?: (value: string) => void;
  onSortChange?: (value: string) => void;
  departments?: string[]; 
  sortOptions?: SortOption[]; // <--- New dynamic sort options
}

export default function GlobalFilters({
  onYearChange,
  onDepartmentChange,
  onQuarterChange,
  onSortChange,
  departments = ["Engineering", "Finance", "HR", "Marketing", "Sales"],
  sortOptions = [] // default to empty array
}: GlobalFiltersProps) {
  
  const currentYear = new Date().getFullYear().toString()
  const years = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => (parseInt(currentYear) - i).toString())
  }, [currentYear])

  const quarters = ["Q1", "Q2", "Q3", "Q4"]

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-white dark:bg-zinc-950 p-2 shadow-sm">
      
      {/* ── Left Side: Primary Filters ── */}
      <div className="flex flex-wrap items-center gap-2 sm:gap-4">
        {/* Year Filter */}
        <Select defaultValue={currentYear} onValueChange={(val) => { if (val !== null) onYearChange?.(val); }}>
          <SelectTrigger className="w-[140px] bg-slate-50 dark:bg-zinc-900 border-none shadow-none">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Year" />
            </div>
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={year}>{year}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Department Filter */}
        <Select defaultValue="all" onValueChange={(val) => { if (val !== null) onDepartmentChange?.(val); }}>
          <SelectTrigger className="w-[200px] bg-slate-50 dark:bg-zinc-900 border-none shadow-none">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Department" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept} value={dept.toLowerCase()}>{dept}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Quarter Filter */}
        <Select defaultValue="all" onValueChange={(val) => { if (val !== null) onQuarterChange?.(val); }}>
          <SelectTrigger className="w-[150px] bg-slate-50 dark:bg-zinc-900 border-none shadow-none">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder="Quarter" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Quarters</SelectItem>
            {quarters.map((q) => (
              <SelectItem key={q} value={q.toLowerCase()}>{q}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── Right Side: Sorting (Conditional) ── */}
      {sortOptions.length > 0 && (
        <div className="flex items-center">
          <Select defaultValue={sortOptions[0]?.value} onValueChange={(val) => { if (val !== null) onSortChange?.(val); }}>
            <SelectTrigger className="w-[220px] bg-slate-50 dark:bg-zinc-900 border-none shadow-none">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Sort by:</span>
                <SelectValue placeholder="Sort" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

    </div>
  )
}