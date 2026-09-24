import { Shield } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Keyed by roles.key — the catalogue in the database, not an invented enum.
const STYLE: Record<string, string> = {
  ims_admin:          "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-400",
  department_manager: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-400",
  department_contributor: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-400",
  viewer:             "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400",
}

export function RoleBadge({ roleKey, name, departmentCode }: { roleKey: string; name: string; departmentCode?: string | null }) {
  const cls = STYLE[roleKey] ?? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
  const admin = roleKey === "ims_admin"
  return (
    <Badge className={`${cls} hover:${cls} gap-1 text-xs font-medium`}>
      {admin && <Shield className="h-3 w-3" />}
      {name}
      {departmentCode && <span className="opacity-70">· {departmentCode}</span>}
    </Badge>
  )
}
