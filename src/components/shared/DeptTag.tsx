/**
 * A department code as a small grey tag, for lists that can span
 * departments. Server-renderable — it holds nothing.
 */
export default function DeptTag({ code }: { code: string }) {
  return (
    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium tracking-wide bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
      {code}
    </span>
  )
}

/**
 * Whether a list holds rows from more than one department, which is when
 * its Dept column is worth the width. Taken over the full list, not the
 * chip-filtered one, so the column does not appear and vanish as chips
 * toggle.
 */
export function spansDepartments(rows: readonly { departmentCode: string }[]): boolean {
  return new Set(rows.map((r) => r.departmentCode)).size > 1
}
