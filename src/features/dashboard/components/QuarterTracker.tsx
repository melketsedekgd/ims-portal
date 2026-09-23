"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import PageHeader from "@/components/shared/PageHeader"
import PeriodPicker from "@/components/shared/PeriodPicker"
import {
  PILL,
  SIGNOFF_STATUS,
  SIGNOFF_STATUS_LABEL,
} from "@/components/shared/status-styles"
import type { TrackerRow } from "@/features/dashboard/queries"

/** Matches the sign-off header's formatter, so one date reads the same everywhere. */
function shortDate(value: string | null): string {
  if (!value) return "—"
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

/**
 * The four questions IMS is actually asking, in the order they need
 * answering. "Not submitted" folds `returned` in with `open` on purpose:
 * both mean the department still has work to do, and splitting them would
 * make a returned quarter look like progress.
 */
const BUCKETS = [
  { label: "Not submitted", of: (r: TrackerRow) => r.status === "open" || r.status === "returned" },
  { label: "With manager", of: (r: TrackerRow) => r.status === "submitted" },
  { label: "Waiting for IMS", of: (r: TrackerRow) => r.status === "approved" },
  { label: "Signed off", of: (r: TrackerRow) => r.status === "received" },
] as const

/** A signed date and the name against it, stacked. */
function Signature({ at, by }: { at: string | null; by: string | null }) {
  if (!at) return <span className="text-sm text-muted-foreground">—</span>
  return (
    <div className="min-w-0">
      <div className="text-sm text-ink whitespace-nowrap">{shortDate(at)}</div>
      {by && <div className="text-xs text-muted-foreground truncate">{by}</div>}
    </div>
  )
}

/**
 * How much of the quarter's data is in.
 *
 * One percentage over all three populations rather than three separate
 * ones: the question is "is this department's quarter ready", and a
 * department at 100% on KPIs and 0% on objectives is not ready. The
 * breakdown underneath is there so the number can be taken apart.
 */
function Coverage({ row }: { row: TrackerRow }) {
  const due = row.kpiDue + row.objDue + row.riskDue
  const entered = row.kpiEntered + row.objEntered + row.riskReassessed
  const pending = row.status === "open" || row.status === "returned"

  if (due === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Nothing to report this quarter
      </div>
    )
  }

  const pct = Math.round((entered / due) * 100)

  return (
    <div className="min-w-[210px] space-y-1.5">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-slate-100">
          <div
            className={`h-1.5 rounded-full ${pct === 100 ? "bg-emerald-500" : "bg-ink"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-sm font-medium tabular-nums text-ink">{pct}%</span>
      </div>
      <div className="text-xs text-muted-foreground">
        KPI {row.kpiEntered}/{row.kpiDue} · Obj {row.objEntered}/{row.objDue} · Risk{" "}
        {row.riskReassessed}/{row.riskDue}
      </div>
      {/* Only while the department still holds the quarter. Once it is
          submitted, when they last typed is no longer what anyone is
          waiting on. */}
      {pending && (
        <div className="text-xs text-muted-foreground">
          {row.lastEntryAt
            ? `Last entry ${shortDate(row.lastEntryAt)}`
            : "Nothing entered yet"}
        </div>
      )}
    </div>
  )
}

/**
 * Where every department stands on one quarter.
 *
 * A row is a link to that department's dashboard — the same view the
 * selector reaches, because the tracker's job is to say who needs looking
 * at and the next thing you do is look.
 */
export default function QuarterTracker({
  year,
  quarter,
  rows,
  closed,
  viewSelector,
}: {
  year: string
  quarter: string
  rows: TrackerRow[]
  /** The quarter predates sign-off, so there is no trail to show. */
  closed: boolean
  viewSelector: React.ReactNode
}) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const open = (code: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete("view")
    params.set("dept", code)
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex-1 space-y-3 w-full max-w-[1440px] mx-auto p-4 md:p-6">
      <PageHeader
        title="Quarterly Reporting"
        description={`Where every department stands on ${quarter} ${year}.`}
        actions={
          <>
            {viewSelector}
            <PeriodPicker year={year} quarter={quarter} />
          </>
        }
      />

      {closed ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Signed on paper before sign-off existed.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            {BUCKETS.map((b) => (
              <Card key={b.label}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {b.label}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold tabular-nums text-ink">
                    {rows.filter(b.of).length}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data coverage</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Approved</TableHead>
                    <TableHead>Received</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="py-12 text-center text-sm text-muted-foreground"
                      >
                        No departments to report on this quarter.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow
                        key={row.departmentId}
                        onClick={() => open(row.code)}
                        className="cursor-pointer"
                      >
                        <TableCell className="font-medium text-ink">
                          {row.name}
                          <span className="ml-2 text-xs text-muted-foreground">
                            {row.code}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={`${PILL} ${SIGNOFF_STATUS[row.status]}`}>
                            {SIGNOFF_STATUS_LABEL[row.status]}
                          </span>
                          {/* A quarter that has been round the loop more than
                              once is the thing worth noticing about it. */}
                          {row.returnCount > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              returned {row.returnCount}×
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Coverage row={row} />
                        </TableCell>
                        <TableCell>
                          <Signature at={row.submittedAt} by={row.submittedByName} />
                        </TableCell>
                        <TableCell>
                          <Signature at={row.approvedAt} by={row.approvedByName} />
                        </TableCell>
                        <TableCell>
                          <Signature at={row.receivedAt} by={row.receivedByName} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
