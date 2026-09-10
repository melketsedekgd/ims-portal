"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FileText, FileBarChart, User, ArrowRight } from "lucide-react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

import SlideOutSheet from "@/components/shared/SlideOutSheet"
import PeriodSnapshotPanel from "@/features/reports/components/PeriodSnapshotPanel"
import type { PeriodSnapshot } from "@/features/reports/queries"

export default function ReportsView({
  snapshot,
  preparedBy,
  year,
  quarter,
}: {
  snapshot: PeriodSnapshot
  preparedBy: string
  year: string
  quarter: string
}) {
  const router = useRouter()
  const [isSheetOpen, setIsSheetOpen] = useState(false)

  const period = `${quarter} ${year}`

  // URL-driven state updates
  const setPeriod = (next: { year?: string; quarter?: string }) => {
    const params = new URLSearchParams({
      year: next.year ?? year,
      quarter: next.quarter ?? quarter,
    })
    router.push(`?${params.toString()}`)
  }

  return (
    <div className="flex-1 p-4 md:p-6 space-y-8 w-full max-w-[1600px] mx-auto relative">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <FileBarChart className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
            <h1 className="text-2xl font-bold tracking-tight">Compliance &amp; Audit Reports</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Review this department&apos;s recorded position for a reporting period.
          </p>
        </div>
        {/* ── Period Picker ── */}
        <div className="flex items-center gap-2">
          <Select value={quarter} onValueChange={(v) => v && setPeriod({ quarter: v })}>
            <SelectTrigger className="w-[80px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Q1","Q2","Q3","Q4"].map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year} onValueChange={(v) => v && setPeriod({ year: v })}>
            <SelectTrigger className="w-[90px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString()).map((y) => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Selected Period ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Selected Period
        </h2>
        <Card className="border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-950/20 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-1">
                <CardTitle className="text-xl flex items-center gap-3">
                  {period} Departmental Review
                  {/* Nothing stores a report, so no period has one. A "Draft"
                      badge would imply a saved draft exists. */}
                  <Badge variant="outline" className="gap-1.5 px-2.5 py-0.5 text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700">
                    <FileText className="h-3 w-3" />
                    Not published
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Objective progress, KPI actuals and the risk register as recorded for {period}.
                </CardDescription>
              </div>
              <Button
                onClick={() => setIsSheetOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shrink-0"
              >
                View Snapshot
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-500/70" />
                Prepared by: {preparedBy}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Published Reports ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Published Reports
        </h2>
        {/* No archive is rendered because nothing stores one. Showing example
            rows here would be showing invented audit records on a page whose
            purpose is the audit trail. */}
        <div className="rounded-md border border-dashed bg-white dark:bg-zinc-950 p-10">
          <div className="flex flex-col items-center justify-center text-center gap-2">
            <FileText className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No reports have been published yet
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              Publishing writes a fixed copy of a period&apos;s figures so they stay
              put afterwards. That is not available yet — until it is, the
              snapshot above is read live from the current records and will move
              if the underlying measurements change.
            </p>
          </div>
        </div>
      </div>

      {/* ── Slide-Out Snapshot ── */}
      <SlideOutSheet
        title={`${period} Data Snapshot`}
        description="Counted from this department's records for the selected period."
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
      >
        <PeriodSnapshotPanel
          period={period}
          snapshot={snapshot}
          preparedBy={preparedBy}
          onCancel={() => setIsSheetOpen(false)}
        />
      </SlideOutSheet>
    </div>
  )
}
