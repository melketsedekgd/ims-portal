"use client"

import { useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Send, AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { recordQuarterDecision } from "@/features/signoff/mutations"
import type { MissingItem } from "@/features/signoff/queries"

/**
 * The checklist and the Submit button for one department.
 *
 * Submit is disabled while anything is missing, but that is a courtesy, not
 * the rule — record_quarter_decision() refuses an incomplete quarter on its
 * own, so a stale page cannot slip one through.
 */
export default function SubmitPanel({
  departmentId,
  departmentName,
  periodId,
  year,
  quarter,
  missing,
  returned,
}: {
  departmentId: string
  departmentName: string
  periodId: string
  year: number
  quarter: string
  missing: MissingItem[]
  returned: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const kpis = missing.filter((m) => m.kind === "kpi")
  const objectives = missing.filter((m) => m.kind === "objective")
  const period = `?year=${year}&quarter=${quarter}`

  const submit = () => {
    startTransition(async () => {
      const r = await recordQuarterDecision({
        departmentId,
        periodId,
        decision: "submit",
      })
      if (r.ok) {
        toast.success(`${departmentName} ${quarter} submitted for review.`)
        router.push(`/sign-off/${r.signoffId}`)
      } else {
        toast.error(r.message)
      }
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium text-ink">
            {returned ? `${departmentName} — returned for changes` : `Submit ${departmentName}`}
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {missing.length === 0
              ? "Every KPI and objective has a value for this quarter."
              : `${missing.length} item${missing.length === 1 ? "" : "s"} still need a value before this quarter can be submitted.`}
          </p>
        </div>
        <Button onClick={submit} disabled={pending || missing.length > 0} className="gap-2">
          <Send className="h-4 w-4" />
          {pending ? "Submitting…" : "Submit for review"}
        </Button>
      </div>

      {missing.length > 0 && (
        <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          {kpis.length > 0 && (
            <MissingGroup
              title={`KPIs without a value (${kpis.length})`}
              items={kpis}
              href={(m) => `/department/kpis/${m.itemId}${period}`}
            />
          )}
          {objectives.length > 0 && (
            <MissingGroup
              title={`Objectives without a value (${objectives.length})`}
              items={objectives}
              href={(m) => `/department/objectives/${m.itemId}${period}`}
            />
          )}
          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            Recording &ldquo;not measured&rdquo; counts as a value. It is how the reports say
            there was no data this quarter.
          </p>
        </div>
      )}
    </div>
  )
}

function MissingGroup({
  title,
  items,
  href,
}: {
  title: string
  items: MissingItem[]
  href: (m: MissingItem) => string
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1.5">
        {title}
      </p>
      <ul className="space-y-1">
        {items.map((m) => (
          <li key={m.itemId}>
            <Link
              href={href(m)}
              className="text-sm text-ink hover:underline underline-offset-2 line-clamp-1"
            >
              {m.name}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
