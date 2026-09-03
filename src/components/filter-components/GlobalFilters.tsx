"use client"

import { useMemo } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface GlobalFiltersProps {
  onYearChange?: (value: string) => void;
  onDepartmentChange?: (value: string) => void;
  onQuarterChange?: (value: string) => void;
  // Accept departments as a prop so they can be fetched dynamically by the parent
  departments?: string[]; 
}

export default function GlobalFilters({
  onYearChange,
  onDepartmentChange,
  onQuarterChange,
  departments = ["Engineering", "Finance", "HR", "Marketing", "Sales"] // Fallback defaults
}: GlobalFiltersProps) {
  
  // Dynamically generate the last 15 years starting from the current year
  const currentYear = new Date().getFullYear().toString()
  const years = useMemo(() => {
    return Array.from({ length: 15 }, (_, i) => (parseInt(currentYear) - i).toString())
  }, [currentYear])

  const quarters = ["Q1", "Q2", "Q3", "Q4"]

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-3 shadow-sm">
      
      {/* Year Filter - Defaults to current year */}
      <Select defaultValue={currentYear} onValueChange={onYearChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select Year" />
        </SelectTrigger>
        {/* SelectContent automatically handles scrolling for long lists in shadcn */}
        <SelectContent>
          {years.map((year) => (
            <SelectItem key={year} value={year}>{year}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Department Filter - Defaults to "all" */}
      <Select defaultValue="all" onValueChange={onDepartmentChange}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Select Department" />
        </SelectTrigger>
        <SelectContent>
          {/* Static "All Departments" option at the top */}
          <SelectItem value="all">All Departments</SelectItem>
          {departments.map((dept) => (
            <SelectItem key={dept} value={dept.toLowerCase()}>{dept}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Quarter Filter - Defaults to "all" for consistency */}
      <Select defaultValue="all" onValueChange={onQuarterChange}>
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Select Quarter" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Quarters</SelectItem>
          {quarters.map((q) => (
            <SelectItem key={q} value={q.toLowerCase()}>{q}</SelectItem>
          ))}
        </SelectContent>
      </Select>

    </div>
  )
}