"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Target, Trash2, Lock, ChevronDown, ChevronRight } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import type {
  ObjectiveListItem,
  ObjectiveLifecycle,
} from "@/features/objectives/queries"

// ── Lifecycle: a fact about the objective, independent of the period ──
function StatusBadge({ status }: { status: ObjectiveLifecycle }) {
  switch (status) {
    case "Active":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400">Active</Badge>
    case "Achieved":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Achieved</Badge>
    case "Retired":
      return <Badge variant="outline" className="text-slate-500 dark:text-zinc-400 border-slate-300 dark:border-zinc-700">Retired</Badge>
  }
}

// ── Outcome: what this period's report actually said ──
//
// The four cases are different claims and none of them is zero. A percentage
// is only ever shown when a snapshot exists and says something.
function AchievementCell({ row }: { row: ObjectiveListItem }) {
  switch (row.outcome) {
    case "measured":
      return (
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold tabular-nums">
            {row.achievement === null ? "—" : `${Math.round(row.achievement * 100)}%`}
          </span>
          {row.activitiesTotal !== null && (
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {row.activitiesCompleted ?? 0} of {row.activitiesTotal} activities
            </span>
          )}
        </div>
      )
    case "not_measured":
      // Explicitly N/A for the period. Not zero, and excluded from averages.
      return (
        <Badge variant="outline" className="text-muted-foreground font-medium">
          N/A
        </Badge>
      )
    case "completed_earlier":
      // Done in an earlier quarter and dropped off this report. The emerald
      // "Achieved" badge already carries the good news, so this stays plain
      // text rather than double-signalling it.
      return (
        <span className="text-xs text-muted-foreground italic">
          Completed in an earlier period
        </span>
      )
    case "not_reported":
      // The only case that means "outstanding".
      return (
        <Badge variant="outline" className="text-muted-foreground font-medium border-dashed">
          Not reported
        </Badge>
      )
  }
}

export default function ObjectivesTable({
  initialData,
  year,
  quarter,
}: {
  initialData: ObjectiveListItem[]
  year: string
  quarter: string
}) {
  const router = useRouter()
  const [data, setData] = useState<ObjectiveListItem[]>(initialData)
  const [objToDelete, setObjToDelete] = useState<ObjectiveListItem | null>(null)

  const periodLabel = `${quarter} ${year}`

  // URL-driven state updates
  const setPeriod = (next: { year?: string; quarter?: string }) => {
    const params = new URLSearchParams({
      year: next.year ?? year,
      quarter: next.quarter ?? quarter,
    })
    router.push(`?${params.toString()}`)
  }

  // Achieved objectives are done; retired ones are historical. Neither is
  // editable from the list.
  const isLocked = (obj: ObjectiveListItem) =>
    obj.status === "Achieved" || obj.status === "Retired"

  // Collapsible process groups
  const [collapsedProcesses, setCollapsedProcesses] = useState<Set<string>>(new Set())

  const toggleProcess = (processName: string) => {
    setCollapsedProcesses(prev => {
      const next = new Set(prev)
      if (next.has(processName)) {
        next.delete(processName)
      } else {
        next.add(processName)
      }
      return next
    })
  }

  const handleDelete = () => {
    if (objToDelete) {
      setData(data.filter(obj => obj.id !== objToDelete.id))
      toast.success(`"${objToDelete.name}" was permanently deleted.`)
      setObjToDelete(null)
    }
  }

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6 text-blue-600" />
            <h1 className="text-2xl font-bold tracking-tight">Objectives</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Define and track departmental objectives and their quarterly progress.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ── Period Picker ── */}
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
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9"
            onClick={() => router.push("/department/objectives/new")}
          >
            <Plus className="h-4 w-4" />
            Create Objective
          </Button>
        </div>
      </div>

      {/* ── Objectives Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table className="table-fixed">
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Objective</TableHead>
              <TableHead className="h-10 w-[130px]">Target Date</TableHead>
              <TableHead className="h-10 w-[170px]">Achievement</TableHead>
              <TableHead className="h-10 w-[130px]">Status</TableHead>
              <TableHead className="h-10 w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 py-6">
                    <Target className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      No objectives found for {periodLabel}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      There are no registered objectives for this reporting period. You can create a new objective or switch to a different period.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-xs gap-1.5"
                      onClick={() => router.push("/department/objectives/new")}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Objective
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (() => {
              const groups = data.reduce<Record<string, ObjectiveListItem[]>>((acc, obj) => {
                const key = obj.processName || "General"
                if (!acc[key]) acc[key] = []
                acc[key].push(obj)
                return acc
              }, {})

              return Object.entries(groups).flatMap(([processName, objs]) => {
                const isCollapsed = collapsedProcesses.has(processName)
                return [
                  // ── Process Section Header Row (clickable toggle) ──
                  <TableRow
                    key={`group-${processName}`}
                    className="bg-slate-50/80 dark:bg-zinc-900/60 hover:bg-slate-100/80 dark:hover:bg-zinc-900/80 cursor-pointer select-none"
                    onClick={() => toggleProcess(processName)}
                  >
                    <TableCell colSpan={5} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        }
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                          {processName}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-zinc-500 ml-1">
                          ({objs.length} {objs.length === 1 ? "objective" : "objectives"})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed ? objs.map((row) => {
                    const locked = isLocked(row)
                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => router.push(`/department/objectives/${row.id}`)}
                        className={`transition-colors cursor-pointer align-top ${locked ? "bg-slate-50/60 dark:bg-zinc-900/30 hover:bg-slate-100/60 dark:hover:bg-zinc-900/50 opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}`}
                      >
                        {/* Titles run to full paragraphs — some IT objectives are
                            ~400 characters — so the cell clamps to two lines and
                            keeps the full text in the tooltip. */}
                        <TableCell className="pl-6 py-3">
                          <div className="flex items-start gap-2">
                            {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />}
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span
                                className="font-semibold text-slate-900 dark:text-slate-100 text-sm line-clamp-2"
                                title={row.name}
                              >
                                {row.name}
                              </span>
                              {row.description && (
                                <p
                                  className="text-xs text-muted-foreground line-clamp-1"
                                  title={row.description}
                                >
                                  {row.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground tabular-nums">
                          {row.targetDate ?? "—"}
                        </TableCell>
                        <TableCell>
                          <AchievementCell row={row} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
                        </TableCell>
                        <TableCell>
                          {locked ? (
                            <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 font-medium px-1">
                              <Lock className="h-3 w-3" />
                            </div>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors z-10 relative"
                              title="Delete Objective"
                              onClick={(e) => {
                                e.stopPropagation()
                                setObjToDelete(row)
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  }) : [])
                ]
              })
            })()}
          </TableBody>
        </Table>
      </div>

      {/* ── Custom Delete Alert Dialog ── */}
      {objToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Are you sure?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete <strong className="text-slate-900 dark:text-slate-100">{objToDelete.name}</strong> and all of its recorded progress. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setObjToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Objective
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
