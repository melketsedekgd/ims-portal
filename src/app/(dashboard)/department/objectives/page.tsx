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

import { ObjectiveFormData, ObjectiveStatus } from "@/components/forms/ObjectiveForm"
import { mockObjectives } from "@/lib/mockData"

// ── Status Badge Renderer ──
function StatusBadge({ status }: { status: ObjectiveStatus }) {
  switch (status) {
    case "Achieved":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Achieved</Badge>
    case "On Track":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400">On Track</Badge>
    case "At Risk":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400">At Risk</Badge>
    case "Off Track":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Off Track</Badge>
  }
}

// ── Page Component ──
export default function ObjectivesPage() {
  const router = useRouter()
  const [data, setData] = useState<ObjectiveFormData[]>(mockObjectives)
  const [objToDelete, setObjToDelete] = useState<ObjectiveFormData | null>(null)

  // Reporting Period
  const [activeQuarter, setActiveQuarter] = useState("ALL")
  const [activeYear, setActiveYear] = useState("2026")
  const periodLabel = activeQuarter === "ALL" 
    ? (activeYear === "ALL" ? "All Periods" : `All Quarters ${activeYear}`)
    : (activeYear === "ALL" ? `${activeQuarter} (All Years)` : `${activeQuarter} ${activeYear}`)

  // Filter data by activeQuarter and activeYear
  const filteredData = data.filter((obj) => {
    if (!obj.targetDate) return true
    const parts = obj.targetDate.split(" ")
    const q = parts[0]
    const y = parts[1]
    const quarterMatch = activeQuarter === "ALL" || q === activeQuarter
    const yearMatch = activeYear === "ALL" || y === activeYear
    return quarterMatch && yearMatch
  })

  // An objective is "locked" once it has been marked Achieved
  const isLocked = (obj: ObjectiveFormData) => obj.status === "Achieved"

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
            Define and track departmental objectives linked to measurable KPIs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* ── Period Picker ── */}
          <Select value={activeQuarter} onValueChange={(v) => v && setActiveQuarter(v)}>
            <SelectTrigger className="w-[125px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue placeholder="Quarter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Quarters</SelectItem>
              <SelectItem value="Q1">Q1</SelectItem>
              <SelectItem value="Q2">Q2</SelectItem>
              <SelectItem value="Q3">Q3</SelectItem>
              <SelectItem value="Q4">Q4</SelectItem>
            </SelectContent>
          </Select>
          <Select value={activeYear} onValueChange={(v) => v && setActiveYear(v)}>
            <SelectTrigger className="w-[110px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Years</SelectItem>
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
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Objective</TableHead>
              <TableHead className="h-10">Linked KPIs</TableHead>
              <TableHead className="h-10">Target Date</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10 w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-48 text-center">
                  <div className="flex flex-col items-center justify-center space-y-2 py-6">
                    <Target className="h-8 w-8 text-muted-foreground/50" />
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      No objectives found for {periodLabel}
                    </p>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      There are no registered objectives for this reporting period. You can create a new objective or switch to a different period filter.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 text-xs gap-1.5"
                      onClick={() => router.push("/department/objectives/new")}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Create Objective for {periodLabel}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (() => {
              const groups = filteredData.reduce<Record<string, ObjectiveFormData[]>>((acc, obj) => {
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
                        className={`transition-colors cursor-pointer ${locked ? "bg-slate-50/60 dark:bg-zinc-900/30 hover:bg-slate-100/60 dark:hover:bg-zinc-900/50 opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}`}
                      >
                        <TableCell className="font-medium max-w-[320px] pl-6 py-3">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                              <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate" title={row.name}>
                                {row.name}
                              </span>
                            </div>
                            {row.successCriteria && (
                              <p className="text-xs text-muted-foreground line-clamp-1 italic">
                                Criteria: {row.successCriteria}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1 max-w-[240px]">
                            {row.linkedKpis.length > 0 ? row.linkedKpis.map((kpi) => (
                              <Badge key={kpi} variant="outline" className="text-[11px] font-normal text-muted-foreground px-2 py-0.5 bg-slate-50 dark:bg-zinc-900">
                                {kpi}
                              </Badge>
                            )) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-medium text-muted-foreground">
                          {row.targetDate}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1 items-start">
                            <StatusBadge status={row.status} />
                            {row.actualPerformance && (
                              <span className="text-[11px] text-muted-foreground font-mono truncate max-w-[150px]">
                                {row.actualPerformance}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {locked ? (
                            <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 font-medium px-1">
                              <Lock className="h-3 w-3" />
                              <span>Closed</span>
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
              This will permanently delete <strong className="text-slate-900 dark:text-slate-100">{objToDelete.name}</strong> and unlink all associated KPIs. This action cannot be undone.
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
