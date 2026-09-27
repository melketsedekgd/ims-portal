"use client"

import Link from "next/link"
import { CheckCircle2 } from "lucide-react"
import { buttonVariants } from "@/components/ui/button"
import type { CommitCounts } from "../mutations"
import type { ImportReview } from "../queries"

/** Step 5: what commit_import reported, and what each replace overwrote. */
export default function ResultStep({
  review,
  counts,
  listHref,
}: {
  review: ImportReview
  counts: CommitCounts
  listHref: string
}) {
  const kpiName = new Map(review.kpis.map((k) => [k.id, k.name]))
  const replaced = review.rows.filter((r) => r.previous !== null)
  const unitLabel = new Map(review.units.map((u) => [u.key, u.label]))
  const now = (r: ImportReview["rows"][number]) =>
    r.notMeasured
      ? "N/A"
      : (r.actualText ??
        ([r.actualValue, r.actualUnit ? unitLabel.get(r.actualUnit) : null].filter((x) => x != null).join(" ") ||
          "—"))

  const figures = [
    { label: "Imported", value: counts.imported, hint: "new results" },
    { label: "Replaced", value: counts.replaced, hint: "existing results overwritten" },
    { label: "Skipped", value: counts.skipped, hint: "already recorded, kept" },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-5 w-5" />
        <p className="font-medium">Import complete.</p>
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {figures.map((f) => (
          <div key={f.label} className="rounded-lg border p-4">
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="text-2xl font-semibold tabular-nums">{f.value}</dd>
            <dd className="text-xs text-muted-foreground">{f.hint}</dd>
          </div>
        ))}
      </dl>

      {replaced.length > 0 && (
        <div className="rounded-lg border overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Replaced KPI</th>
                <th className="text-left font-medium px-3 py-2">Was</th>
                <th className="text-left font-medium px-3 py-2">Now</th>
              </tr>
            </thead>
            <tbody>
              {replaced.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2">{r.kpiId ? kpiName.get(r.kpiId) : "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.previous || "—"}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {now(r)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link href={listHref} className={buttonVariants()}>
        View the quarter&apos;s KPIs
      </Link>
    </div>
  )
}
