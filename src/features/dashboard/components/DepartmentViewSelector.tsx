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
import { ALL_DEPARTMENTS, nextViewParams } from "@/features/dashboard/view"

// Long department names, as in DepartmentFilter, get one line and an ellipsis, with the full name as
// a tooltip. The trigger keeps a fixed width; the menu may grow a little past
// it but never past the viewport. The primitive's item text refuses to
// shrink, so the first child (the item text) is let shrink here instead.
const MENU = "w-auto min-w-(--anchor-width) max-w-[min(20rem,calc(100vw-2rem))]"
const ITEM = "[&>:first-child]:min-w-0 [&>:first-child]:shrink"

/**
 * Which dashboard an IMS user is looking at. Rendered only for IMS.
 *
 * Holds no state, for the same reason PeriodPicker holds none: the view
 * lives in the URL and the server component re-runs on it. This pushes the
 * next URL and nothing else — and `value` comes from the same resolution
 * the page rendered from, so the trigger can never name a view other than
 * the one on screen.
 *
 * `all` and a department code cannot collide — departmentSchema uppercases
 * every code on the way in, so no department is ever coded "all".
 */
export default function DepartmentViewSelector({
  departments,
  value,
  ownCode,
}: {
  departments: DashboardDepartment[]
  /** ALL_DEPARTMENTS, or the code of the department being shown. */
  value: string
  /** IMS's own department code — the default view. */
  ownCode: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const own = departments.find((d) => d.code === ownCode)
  const others = departments.filter((d) => d.code !== ownCode)

  // Base UI resolves the trigger's label from `items`; without it the
  // trigger renders the raw value, so the selector would sit there reading
  // "all" or "SRD" while the page below it says "All departments" or
  // "Software Research and Development".
  const items: Record<string, string> = {
    [ALL_DEPARTMENTS]: "All departments",
    ...Object.fromEntries(others.map((d) => [d.code, d.name])),
  }
  if (own) items[own.code] = "IMS (own)"

  const push = (next: string) => {
    // An absolute path rather than a bare "?query": a query-only push is
    // resolved against whatever the current URL happens to be, and this
    // component is rendered on two different views.
    const query = nextViewParams(new URLSearchParams(params.toString()), next)
    const suffix = query.toString()
    router.push(suffix ? `${pathname}?${suffix}` : pathname)
  }

  return (
    <Select items={items} value={value} onValueChange={(v) => v && push(String(v))}>
      <SelectTrigger
        aria-label="Dashboard view"
        title={items[value]}
        className="w-[240px] h-9 text-sm bg-white border-slate-200"
      >
        <SelectValue>{(v: string) => <span className="truncate">{items[v] ?? v}</span>}</SelectValue>
      </SelectTrigger>
      <SelectContent className={MENU}>
        {own && <SelectItem value={own.code}>IMS (own)</SelectItem>}
        <SelectItem value={ALL_DEPARTMENTS}>All departments</SelectItem>
        {others.length > 0 && <SelectSeparator />}
        {others.map((d) => (
          <SelectItem key={d.code} value={d.code} className={ITEM}>
            <span className="truncate" title={d.name}>
              {d.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
