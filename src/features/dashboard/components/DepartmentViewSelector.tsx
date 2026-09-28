"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { cn } from "@/lib/utils"
import type { DashboardDepartment } from "@/features/dashboard/queries"
import { ALL_DEPARTMENTS, nextViewParams } from "@/features/dashboard/view"

// Long department names get one line and an ellipsis, with the full name as
// a tooltip, so one long name cannot push the pill group off the header.
const PILL_BASE =
  "h-7 max-w-[14rem] truncate rounded-full px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
// coral-600 rather than coral: white text on --coral is under 4.5:1.
const PILL_ACTIVE = "bg-coral-600 text-white shadow-sm"
const PILL_IDLE = "bg-transparent text-ink hover:bg-ink/5"

/**
 * Which dashboard an IMS user is looking at. Rendered only for IMS.
 *
 * Holds no state, for the same reason PeriodPicker holds none: the view
 * lives in the URL and the server component re-runs on it. This pushes the
 * next URL and nothing else — and `value` comes from the same resolution
 * the page rendered from, so the active pill can never name a view other than
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

  // Same order the dropdown had: IMS's own, everyone, then each department.
  const options: { value: string; label: string }[] = [
    ...(own ? [{ value: own.code, label: "IMS (own)" }] : []),
    { value: ALL_DEPARTMENTS, label: "All departments" },
    ...others.map((d) => ({ value: d.code, label: d.name })),
  ]

  const push = (next: string) => {
    // An absolute path rather than a bare "?query": a query-only push is
    // resolved against whatever the current URL happens to be, and this
    // component is rendered on two different views.
    const query = nextViewParams(new URLSearchParams(params.toString()), next)
    const suffix = query.toString()
    router.push(suffix ? `${pathname}?${suffix}` : pathname)
  }

  return (
    <div
      role="group"
      aria-label="Dashboard view"
      className="glass flex flex-wrap items-center gap-1 rounded-full p-1"
    >
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            title={o.label}
            onClick={() => !active && push(o.value)}
            className={cn(PILL_BASE, active ? PILL_ACTIVE : PILL_IDLE)}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
