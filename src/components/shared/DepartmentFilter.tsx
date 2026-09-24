"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { DashboardDepartment } from "@/features/dashboard/queries"
import { ALL_DEPARTMENTS, nextListDeptParams } from "@/features/dashboard/view"

/**
 * Narrows a KPI, objective or risk list to one department. Rendered only
 * for IMS; the page decides that and passes nothing for anyone else.
 *
 * Holds no state, like PeriodPicker and DepartmentViewSelector: the
 * department lives in ?dept= and the server query filters on it. `value`
 * comes from the same resolveListDepartment call the page fetched with, so
 * the trigger cannot name a department other than the one listed.
 */
export default function DepartmentFilter({
  departments,
  value,
}: {
  departments: DashboardDepartment[]
  /** ALL_DEPARTMENTS, or the code of the department being listed. */
  value: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  // Base UI resolves the trigger's label from `items`; without it the
  // trigger shows the raw code.
  const items: Record<string, string> = {
    [ALL_DEPARTMENTS]: "All departments",
    ...Object.fromEntries(departments.map((d) => [d.code, d.name])),
  }

  const push = (next: string) => {
    const query = nextListDeptParams(new URLSearchParams(params.toString()), next)
    const suffix = query.toString()
    router.push(suffix ? `${pathname}?${suffix}` : pathname)
  }

  return (
    <Select items={items} value={value} onValueChange={(v) => v && push(String(v))}>
      <SelectTrigger
        aria-label="Department"
        className="w-[220px] h-9 text-sm bg-white border-slate-200"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
        {departments.length > 0 && <SelectSeparator />}
        {departments.map((d) => (
          <SelectItem key={d.code} value={d.code}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
