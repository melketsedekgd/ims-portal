import Link from "next/link"

import PageHeader from "@/components/shared/PageHeader"
import PeriodPicker from "@/components/shared/PeriodPicker"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PILL, SIGNOFF_STATUS, SIGNOFF_STATUS_LABEL } from "@/components/shared/status-styles"
import {
  getDefaultSignoffPeriod,
  getSignoffIndex,
  getMissingItems,
} from "@/features/signoff/queries"
import SubmitPanel from "@/features/signoff/components/SubmitPanel"

function when(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export default async function SignOffPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>
}) {
  const params = await searchParams

  // The period lives in the URL. Only the first visit, with nothing in it,
  // falls back to the quarter that still needs signing.
  const fallback = await getDefaultSignoffPeriod()
  const year = Number(params.year ?? fallback.year)
  const quarter = params.quarter ?? fallback.label

  const { period, rows } = await getSignoffIndex(year, quarter)

  // The checklist is only fetched for departments that could act on it.
  const panels = period
    ? await Promise.all(
        rows
          .filter((r) => r.canSubmit)
          .map(async (r) => ({
            row: r,
            missing: await getMissingItems(r.departmentId, period.id),
          }))
      )
    : []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quarter sign-off"
        description="Each department prepares its quarter, its manager approves it, and IMS receives it. Submitting locks the figures."
        actions={<PeriodPicker year={String(year)} quarter={quarter} />}
      />

      {!period ? (
        <p className="text-sm text-muted-foreground">
          {quarter} {year} is not a quarterly reporting period.
        </p>
      ) : period.status === "closed" ? (
        <p className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 text-sm text-muted-foreground">
          Closed — locked before sign-off existed. {quarter} {year} was signed on
          paper; there is nothing to record here.
        </p>
      ) : (
        <>
          {panels.map(({ row, missing }) => (
            <SubmitPanel
              key={row.departmentId}
              departmentId={row.departmentId}
              departmentName={row.departmentName}
              periodId={period.id}
              year={year}
              quarter={quarter}
              missing={missing}
              returned={row.status === "returned"}
            />
          ))}

          <div className="rounded-lg border border-slate-200 dark:border-slate-800">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Prepared by</TableHead>
                  <TableHead>Approved by</TableHead>
                  <TableHead>Received by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-sm text-muted-foreground">
                      No departments to show.
                    </TableCell>
                  </TableRow>
                )}
                {rows.map((r) => (
                  <TableRow key={r.departmentId}>
                    <TableCell className="font-medium">
                      {r.signoffId ? (
                        <Link href={`/sign-off/${r.signoffId}`} className="hover:underline underline-offset-2">
                          {r.departmentName}
                        </Link>
                      ) : (
                        r.departmentName
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={`${PILL} ${SIGNOFF_STATUS[r.status]}`}>
                        {SIGNOFF_STATUS_LABEL[r.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.submittedBy ?? "—"}
                      <span className="block text-xs text-muted-foreground">{when(r.submittedAt)}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.approvedBy ?? "—"}
                      <span className="block text-xs text-muted-foreground">{when(r.approvedAt)}</span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {r.receivedBy ?? "—"}
                      <span className="block text-xs text-muted-foreground">{when(r.receivedAt)}</span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  )
}
