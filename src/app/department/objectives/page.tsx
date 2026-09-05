"use client"

import { useState } from "react"
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

import SlideOutSheet from "@/components/shared/SlideOutSheet"

// ── Types ──

export type ObjectiveStatus = "On Track" | "At Risk" | "Off Track" | "Achieved"

export interface ObjectiveFormData {
  id?: string
  processName: string
  name: string
  description: string
  targetDate: string            // e.g. "Q2 2026"
  status: ObjectiveStatus
  linkedKpis: string[]          // KPI names from the same process
}

// ── Mock Data (linked to existing KPIs) ──

const initialData: ObjectiveFormData[] = [
  // ── Service Delivery Process ──
  {
    id: "obj-1",
    processName: "Service Delivery",
    name: "Achieve 99.9% System Uptime",
    description: "Ensure all production systems maintain at least 99.9% availability throughout the reporting period.",
    targetDate: "Q4 2026",
    status: "At Risk",
    linkedKpis: ["System Uptime (Availability)", "Latency"],
  },
  {
    id: "obj-2",
    processName: "Service Delivery",
    name: "Reduce Network Latency Below 100ms",
    description: "Optimize network infrastructure to achieve sub-100ms average latency across all endpoints.",
    targetDate: "Q2 2026",
    status: "Achieved",
    linkedKpis: ["Latency"],
  },
  // ── Incident Management Process ──
  {
    id: "obj-3",
    processName: "Incident Management",
    name: "Resolve Incidents Within 4 Hours",
    description: "Improve incident response workflows to bring mean time to resolution under 4 hours.",
    targetDate: "Q3 2026",
    status: "On Track",
    linkedKpis: ["Mean Time to Resolve (MTTR)", "Incident Recurrence Rate"],
  },
  // ── Change Management Process ──
  {
    id: "obj-4",
    processName: "Change Management",
    name: "Reduce Failed Change Rate to Under 5%",
    description: "Implement stricter change review and rollback procedures to reduce failed deployments.",
    targetDate: "Q3 2026",
    status: "Off Track",
    linkedKpis: ["Failed Change Rate"],
  },
]

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
  const [data, setData] = useState<ObjectiveFormData[]>(initialData)

  // Modals & Sheets State
  const [objToDelete, setObjToDelete] = useState<ObjectiveFormData | null>(null)
  const [objToEdit, setObjToEdit] = useState<ObjectiveFormData | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  // Reporting Period
  const [activeQuarter, setActiveQuarter] = useState("Q1")
  const [activeYear, setActiveYear] = useState(new Date().getFullYear().toString())
  const periodLabel = `${activeQuarter} ${activeYear}`

  // An objective is "locked" once it has been marked Achieved
  const isLocked = (obj: ObjectiveFormData) => obj.status === "Achieved"

  const [isReadOnly, setIsReadOnly] = useState(false)

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

  const handleRowClick = (obj: ObjectiveFormData) => {
    if (isLocked(obj)) {
      setIsReadOnly(true)
    } else {
      setIsReadOnly(false)
    }
    setObjToEdit(obj)
  }

  const handleDelete = () => {
    if (objToDelete) {
      setData(data.filter(obj => obj.id !== objToDelete.id))
      toast.success(`"${objToDelete.name}" was permanently deleted.`)
      setObjToDelete(null)
    }
  }

  // Department-specific processes — will be consumed by ObjectiveForm in Brick B
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const processes = [
    "Service Delivery",
    "Incident Management",
    "Change Management",
    "Problem Management",
  ]

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
            <SelectTrigger className="w-[80px] h-9 text-sm bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["Q1","Q2","Q3","Q4"].map((q) => (
                <SelectItem key={q} value={q}>{q}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={activeYear} onValueChange={(v) => v && setActiveYear(v)}>
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
            onClick={() => setIsCreateSheetOpen(true)}
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
            {(() => {
              const groups = data.reduce<Record<string, ObjectiveFormData[]>>((acc, obj) => {
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
                        onClick={() => handleRowClick(row)}
                        className={`transition-colors cursor-pointer ${locked ? "bg-slate-50/60 dark:bg-zinc-900/30 hover:bg-slate-100/60 dark:hover:bg-zinc-900/50 opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}`}
                      >
                        <TableCell className="font-medium max-w-[300px] pl-6">
                          <div className="flex items-center gap-2 truncate" title={row.name}>
                            {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                            <span className="truncate">{row.name}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {row.linkedKpis.length > 0 ? row.linkedKpis.map((kpi) => (
                              <Badge key={kpi} variant="outline" className="text-xs font-normal text-muted-foreground px-2 py-0.5">
                                {kpi}
                              </Badge>
                            )) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{row.targetDate}</TableCell>
                        <TableCell>
                          <StatusBadge status={row.status} />
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

      {/* ── Edit / View Objective Sheet (form placeholder for Brick B) ── */}
      <SlideOutSheet
        title={isReadOnly ? `${periodLabel} Objective (Read-Only)` : `Update ${periodLabel} Objective`}
        description={isReadOnly
          ? "This objective has been achieved and is locked for audit integrity."
          : `Review and update objective progress for ${periodLabel}.`
        }
        isOpen={!!objToEdit}
        onClose={() => { setObjToEdit(null); setIsReadOnly(false) }}
      >
        {objToEdit && (
          <div className="space-y-5">
            {/* Read-only preview — will be replaced by ObjectiveForm in Brick B */}
            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Process</p>
                <p className="text-sm font-medium">{objToEdit.processName}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Objective</p>
                <p className="text-sm font-medium">{objToEdit.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{objToEdit.description}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Target Date</p>
                <p className="text-sm">{objToEdit.targetDate}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                <StatusBadge status={objToEdit.status} />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Linked KPIs</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {objToEdit.linkedKpis.length > 0 ? objToEdit.linkedKpis.map((kpi) => (
                    <Badge key={kpi} variant="outline" className="text-xs font-normal px-2 py-0.5">
                      {kpi}
                    </Badge>
                  )) : (
                    <span className="text-sm text-muted-foreground">No KPIs linked</span>
                  )}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t dark:border-zinc-800">
              <Button variant="outline" className="w-full" onClick={() => { setObjToEdit(null); setIsReadOnly(false) }}>
                {isReadOnly ? "Close Record" : "Close"}
              </Button>
            </div>
          </div>
        )}
      </SlideOutSheet>

      {/* ── Create Objective Sheet (form placeholder for Brick B) ── */}
      <SlideOutSheet
        title="Create New Objective"
        description="Define a new departmental objective for this reporting cycle."
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            The ObjectiveForm component will be built in Brick B.
          </p>
          <Button variant="outline" className="w-full" onClick={() => setIsCreateSheetOpen(false)}>
            Close
          </Button>
        </div>
      </SlideOutSheet>
    </div>
  )
}
