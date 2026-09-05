"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileSpreadsheet, Trash2, Lock, ChevronDown, ChevronRight } from "lucide-react"

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
import KpiForm, { KpiFormData } from "@/components/forms/KpiForm"

const initialData: KpiFormData[] = [
  // ── Service Delivery Process ──
  {
    id: "kpi-1",
    processName: "Service Delivery",
    name: "Latency",
    target: "< 170ms",
    actual: "96.733 ms",
    status: "Achieved",
    justification: "",
  },
  {
    id: "kpi-2",
    processName: "Service Delivery",
    name: "System Uptime (Availability)",
    target: "99.9%",
    actual: "98.2%",
    status: "Deviated",
    justification: "Core router failure on Mar 12th resulted in 4 hours downtime.",
  },
  // ── Incident Management Process ──
  {
    id: "kpi-3",
    processName: "Incident Management",
    name: "Mean Time to Resolve (MTTR)",
    target: "< 4 Hours",
    actual: "",
    status: "Pending",
    justification: "",
  },
  {
    id: "kpi-4",
    processName: "Incident Management",
    name: "Incident Recurrence Rate",
    target: "< 10%",
    actual: "7%",
    status: "Achieved",
    justification: "",
  },
  // ── Change Management Process ──
  {
    id: "kpi-5",
    processName: "Change Management",
    name: "Failed Change Rate",
    target: "< 5%",
    actual: "8.2%",
    status: "Deviated",
    justification: "Two emergency patches had insufficient rollback plans.",
  },
]

export default function KPITrackingPage() {
  const [data, setData] = useState<KpiFormData[]>(initialData)
  
  // Modals & Sheets State
  const [kpiToDelete, setKpiToDelete] = useState<KpiFormData | null>(null)
  const [kpiToEdit, setKpiToEdit] = useState<KpiFormData | null>(null)
  const [kpiToUpdate, setKpiToUpdate] = useState<KpiFormData | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  // Reporting Period — will eventually come from the active ReportCycle in DB
  const [activeQuarter, setActiveQuarter] = useState("Q1")
  const [activeYear, setActiveYear] = useState(new Date().getFullYear().toString())
  const periodLabel = `${activeQuarter} ${activeYear}`

  const handleCreate = (formData: KpiFormData) => {
    if (!formData.name.trim() || !formData.target.trim()) {
      toast.error("Please fill in both the KPI description and target.")
      return
    }
    
    const createdKpi: KpiFormData = {
      id: `kpi-${Date.now()}`,
      processName: formData.processName || "General",
      name: formData.name,
      target: formData.target,
      actual: "",
      status: formData.status,
      justification: "",
    }
    
    setData([...data, createdKpi])
    setIsCreateSheetOpen(false)
    toast.success(`"${createdKpi.name}" has been created.`)
  }

  const handleDelete = () => {
    if (kpiToDelete) {
      setData(data.filter(kpi => kpi.id !== kpiToDelete.id))
      toast.success(`"${kpiToDelete.name}" was permanently deleted.`)
      setKpiToDelete(null)
    }
  }

  const handleUpdate = () => {
    if (kpiToUpdate) {
      toast.success(`"${kpiToUpdate.name}" has been updated and logged in the audit trail.`)
      setKpiToUpdate(null)
      setKpiToEdit(null)
    }
  }

  // A KPI is "locked" once it has an actual value and isn't pending
  // Locked rows open in read-only mode to protect the audit trail
  const isLocked = (kpi: KpiFormData) => !!(kpi.actual?.trim()) && kpi.status !== "Pending"

  const [isReadOnly, setIsReadOnly] = useState(false)

  // Collapsible process groups — all expanded by default
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

  const handleRowClick = (kpi: KpiFormData) => {
    if (isLocked(kpi)) {
      setIsReadOnly(true)
    } else {
      setIsReadOnly(false)
    }
    setKpiToEdit(kpi)
  }

  // Department-specific processes — in future this will come from the DB
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
            <FileSpreadsheet className="h-6 w-6 text-emerald-600" />
            <h1 className="text-2xl font-bold tracking-tight">KPI Tracking</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your Key Performance Indicators and input quarterly actuals.
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
            Create KPI
          </Button>
        </div>
      </div>

      {/* ── KPI Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Metric</TableHead>
              <TableHead className="h-10">Target</TableHead>
              <TableHead className="h-10">Actual</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10">Deviation Note</TableHead>
              <TableHead className="h-10 w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              // Group KPIs by processName, preserving insertion order
              const groups = data.reduce<Record<string, KpiFormData[]>>((acc, kpi) => {
                const key = kpi.processName || "General"
                if (!acc[key]) acc[key] = []
                acc[key].push(kpi)
                return acc
              }, {})

              return Object.entries(groups).flatMap(([processName, kpis]) => {
                const isCollapsed = collapsedProcesses.has(processName)
                return [
                  // ── Process Section Header Row (clickable toggle) ──
                  <TableRow
                    key={`group-${processName}`}
                    className="bg-slate-50/80 dark:bg-zinc-900/60 hover:bg-slate-100/80 dark:hover:bg-zinc-900/80 cursor-pointer select-none"
                    onClick={() => toggleProcess(processName)}
                  >
                    <TableCell colSpan={6} className="py-2 px-4">
                      <div className="flex items-center gap-2">
                        {isCollapsed
                          ? <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
                        }
                        <span className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-zinc-400">
                          {processName}
                        </span>
                        <span className="text-xs text-slate-400 dark:text-zinc-500 ml-1">
                          ({kpis.length} {kpis.length === 1 ? "metric" : "metrics"})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed ? kpis.map((row) => {
                  const locked = isLocked(row)
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => handleRowClick(row)}
                      className={`transition-colors cursor-pointer ${locked ? "bg-slate-50/60 dark:bg-zinc-900/30 hover:bg-slate-100/60 dark:hover:bg-zinc-900/50 opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}`}
                    >
                      <TableCell className="font-medium max-w-[250px] pl-6">
                        <div className="flex items-center gap-2 truncate" title={row.name}>
                          {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                          <span className="truncate">{row.name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{row.target}</TableCell>
                      <TableCell className="font-semibold">{row.actual || "-"}</TableCell>
                      <TableCell>
                        {row.status === "Achieved" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Achieved</Badge>
                        ) : row.status === "Deviated" ? (
                          <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Deviated</Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[300px] truncate" title={row.justification}>
                        {row.justification || "-"}
                      </TableCell>
                      <TableCell>
                        {locked ? (
                          <div className="flex items-center gap-1 text-xs text-slate-400 dark:text-zinc-500 font-medium px-1">
                            <Lock className="h-3 w-3" />
                            <span>Submitted</span>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors z-10 relative"
                            title="Delete KPI"
                            onClick={(e) => {
                              e.stopPropagation();
                              setKpiToDelete(row);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                }) : [])
              ]})
            })()}
          </TableBody>
        </Table>
      </div>

      {/* ── Custom Delete Alert Dialog ── */}
      {kpiToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Are you sure?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete <strong className="text-slate-900 dark:text-slate-100">{kpiToDelete.name}</strong> and all of its historical measurements. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setKpiToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete KPI
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create KPI Sheet (Refactored) ── */}
      <SlideOutSheet
        title="Create New KPI"
        description="Define a new Key Performance Indicator for this reporting cycle."
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
      >
        <KpiForm 
          key={isCreateSheetOpen ? "create-open" : "create-closed"}
          isEditMode={false}
          processes={processes}
          onCancel={() => setIsCreateSheetOpen(false)}
          onSubmit={handleCreate}
        />
      </SlideOutSheet>

      {/* ── Edit / View KPI Sheet ── */}
      <SlideOutSheet
        title={isReadOnly ? `${periodLabel} Record (Read-Only)` : `Update ${periodLabel} Measurement`}
        description={isReadOnly
          ? "This record has been submitted and is locked for audit integrity."
          : `Entering actuals for ${periodLabel}. Changes are logged to the audit trail.`
        }
        isOpen={!!kpiToEdit}
        onClose={() => { setKpiToEdit(null); setIsReadOnly(false) }}
      >
        <KpiForm 
          key={kpiToEdit?.id ?? "edit-closed"}
          initialData={kpiToEdit}
          isEditMode={true}
          readOnly={isReadOnly}
          processes={processes}
          onCancel={() => { setKpiToEdit(null); setIsReadOnly(false) }}
          onSubmit={(data) => setKpiToUpdate(data)}
        />
      </SlideOutSheet>

      {/* ── Custom Update Alert Dialog ── */}
      {kpiToUpdate && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Confirm Update</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You are about to update <strong className="text-slate-900 dark:text-slate-100">{kpiToUpdate.name}</strong> for <strong className="text-slate-900 dark:text-slate-100">{periodLabel}</strong>. This change will be logged in the audit trail.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setKpiToUpdate(null)}>
                Cancel
              </Button>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleUpdate}>
                Confirm Update
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
