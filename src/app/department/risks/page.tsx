"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, ShieldAlert, Trash2, Lock, ChevronDown, ChevronRight } from "lucide-react"

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
import RiskForm, { RiskFormData, RiskStatus, AvailableObjective } from "@/components/forms/RiskForm"

// ── Score Helpers ──

function getScoreColor(score: number) {
  if (score >= 15) return { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-800 dark:text-rose-400", label: "Critical" }
  if (score >= 5)  return { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-800 dark:text-amber-400", label: "Medium" }
  return { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-800 dark:text-emerald-400", label: "Low" }
}

function ScoreBadge({ score }: { score: number }) {
  const color = getScoreColor(score)
  return (
    <Badge className={`${color.bg} ${color.text} hover:${color.bg} font-semibold tabular-nums`}>
      {score} · {color.label}
    </Badge>
  )
}

// ── Status Badge ──

function StatusBadge({ status }: { status: RiskStatus }) {
  switch (status) {
    case "Open":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">Open</Badge>
    case "Mitigating":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-900/40 dark:text-amber-400">Mitigating</Badge>
    case "Closed":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">Closed</Badge>
  }
}

// ── Mock Data (linked to existing Objectives) ──

const initialData: RiskFormData[] = [
  // ── Service Delivery Process ──
  {
    id: "risk-1",
    processName: "Service Delivery",
    title: "Core Router Single Point of Failure",
    description: "Primary data center router has no failover. A hardware failure would cause full service outage.",
    likelihood: 3,
    severity: 5,
    riskScore: 15,
    mitigationStrategy: "Procure redundant router and configure automatic failover by Q2 2026.",
    status: "Mitigating",
    linkedObjective: "Achieve 99.9% System Uptime",
  },
  {
    id: "risk-2",
    processName: "Service Delivery",
    title: "CDN Provider Service Degradation",
    description: "Dependency on a single CDN provider creates latency risk if their network degrades.",
    likelihood: 2,
    severity: 3,
    riskScore: 6,
    mitigationStrategy: "Evaluate multi-CDN strategy and implement DNS-based failover.",
    status: "Open",
    linkedObjective: "Reduce Network Latency Below 100ms",
  },
  // ── Incident Management Process ──
  {
    id: "risk-3",
    processName: "Incident Management",
    title: "Understaffed On-Call Rotation",
    description: "Only 2 engineers cover after-hours incidents, leading to delayed response times.",
    likelihood: 4,
    severity: 4,
    riskScore: 16,
    mitigationStrategy: "Hire 2 additional SREs and implement PagerDuty escalation policies.",
    status: "Open",
    linkedObjective: "Resolve Incidents Within 4 Hours",
  },
  {
    id: "risk-4",
    processName: "Incident Management",
    title: "Lack of Automated Incident Detection",
    description: "Most incidents are reported manually by users rather than caught by monitoring.",
    likelihood: 3,
    severity: 3,
    riskScore: 9,
    mitigationStrategy: "Deploy Datadog APM with automated alerting thresholds.",
    status: "Mitigating",
    linkedObjective: "Resolve Incidents Within 4 Hours",
  },
  // ── Change Management Process ──
  {
    id: "risk-5",
    processName: "Change Management",
    title: "Insufficient Rollback Procedures",
    description: "Emergency patches lack documented rollback plans, increasing the risk of failed changes.",
    likelihood: 3,
    severity: 4,
    riskScore: 12,
    mitigationStrategy: "Mandate rollback documentation as a gate in the change approval workflow.",
    status: "Closed",
    linkedObjective: "Reduce Failed Change Rate to Under 5%",
  },
]

// ── Page Component ──

export default function RiskRegisterPage() {
  const [data, setData] = useState<RiskFormData[]>(initialData)

  // Modals & Sheets State
  const [riskToDelete, setRiskToDelete] = useState<RiskFormData | null>(null)
  const [riskToEdit, setRiskToEdit] = useState<RiskFormData | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  // Reporting Period
  const [activeQuarter, setActiveQuarter] = useState("Q1")
  const [activeYear, setActiveYear] = useState(new Date().getFullYear().toString())
  const periodLabel = `${activeQuarter} ${activeYear}`

  // A risk is "locked" once it has been marked Closed
  const isLocked = (risk: RiskFormData) => risk.status === "Closed"

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

  const handleRowClick = (risk: RiskFormData) => {
    if (isLocked(risk)) {
      setIsReadOnly(true)
    } else {
      setIsReadOnly(false)
    }
    setRiskToEdit(risk)
  }

  const [riskToUpdate, setRiskToUpdate] = useState<RiskFormData | null>(null)
  
  const handleCreate = (formData: RiskFormData) => {
    if (!formData.title.trim()) {
      toast.error("Please enter a risk title.")
      return
    }
    const created: RiskFormData = {
      ...formData,
      id: `risk-${Date.now()}`,
      processName: formData.processName || "General",
    }
    setData([...data, created])
    setIsCreateSheetOpen(false)
    toast.success(`"${created.title}" has been logged.`)
  }

  const handleUpdate = () => {
    if (riskToUpdate) {
      setData(data.map(r => r.id === riskToUpdate.id ? riskToUpdate : r))
      toast.success(`"${riskToUpdate.title}" has been updated and logged in the audit trail.`)
      setRiskToUpdate(null)
      setRiskToEdit(null)
    }
  }

  const handleDelete = () => {
    if (riskToDelete) {
      setData(data.filter(r => r.id !== riskToDelete.id))
      toast.success(`"${riskToDelete.title}" was permanently deleted.`)
      setRiskToDelete(null)
    }
  }

  // Department-specific processes
  const processes = [
    "Service Delivery",
    "Incident Management",
    "Change Management",
    "Problem Management",
  ]

  // Available objectives for linking — mirrors the Objectives page mock data
  const availableObjectives: AvailableObjective[] = [
    { name: "Achieve 99.9% System Uptime", processName: "Service Delivery" },
    { name: "Reduce Network Latency Below 100ms", processName: "Service Delivery" },
    { name: "Resolve Incidents Within 4 Hours", processName: "Incident Management" },
    { name: "Reduce Failed Change Rate to Under 5%", processName: "Change Management" },
  ]

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-rose-600" />
            <h1 className="text-2xl font-bold tracking-tight">Risk Register</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Identify, assess, and track risks that threaten departmental objectives.
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
            Log Risk
          </Button>
        </div>
      </div>

      {/* ── Risk Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Risk</TableHead>
              <TableHead className="h-10 w-[80px] text-center">L × S</TableHead>
              <TableHead className="h-10">Score</TableHead>
              <TableHead className="h-10">Linked Objective</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10 w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(() => {
              const groups = data.reduce<Record<string, RiskFormData[]>>((acc, risk) => {
                const key = risk.processName || "General"
                if (!acc[key]) acc[key] = []
                acc[key].push(risk)
                return acc
              }, {})

              return Object.entries(groups).flatMap(([processName, risks]) => {
                const isCollapsed = collapsedProcesses.has(processName)
                return [
                  // ── Process Section Header Row ──
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
                          ({risks.length} {risks.length === 1 ? "risk" : "risks"})
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>,
                  ...(!isCollapsed ? risks.map((row) => {
                    const locked = isLocked(row)
                    return (
                      <TableRow
                        key={row.id}
                        onClick={() => handleRowClick(row)}
                        className={`transition-colors cursor-pointer ${locked ? "bg-slate-50/60 dark:bg-zinc-900/30 hover:bg-slate-100/60 dark:hover:bg-zinc-900/50 opacity-80" : "hover:bg-slate-50 dark:hover:bg-slate-900/50"}`}
                      >
                        <TableCell className="font-medium max-w-[280px] pl-6">
                          <div className="flex items-center gap-2 truncate" title={row.title}>
                            {locked && <Lock className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                            <span className="truncate">{row.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {row.likelihood} × {row.severity}
                          </span>
                        </TableCell>
                        <TableCell>
                          <ScoreBadge score={row.riskScore} />
                        </TableCell>
                        <TableCell>
                          {row.linkedObjective ? (
                            <span className="text-sm text-muted-foreground truncate block max-w-[200px]" title={row.linkedObjective}>
                              {row.linkedObjective}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
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
                              title="Delete Risk"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRiskToDelete(row)
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
      {riskToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Are you sure?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              This will permanently delete <strong className="text-slate-900 dark:text-slate-100">{riskToDelete.title}</strong> from the risk register. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setRiskToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Risk
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit / View Risk Sheet ── */}
      <SlideOutSheet
        title={isReadOnly ? `${periodLabel} Risk (Read-Only)` : `Update ${periodLabel} Risk`}
        description={isReadOnly
          ? "This risk has been closed and is locked for audit integrity."
          : `Review and update risk assessment for ${periodLabel}.`
        }
        isOpen={!!riskToEdit}
        onClose={() => { setRiskToEdit(null); setIsReadOnly(false) }}
      >
        <RiskForm
          key={riskToEdit?.id ?? "edit-closed"}
          initialData={riskToEdit}
          isEditMode={true}
          readOnly={isReadOnly}
          processes={processes}
          availableObjectives={availableObjectives}
          onCancel={() => { setRiskToEdit(null); setIsReadOnly(false) }}
          onSubmit={(data) => setRiskToUpdate(data)}
        />
      </SlideOutSheet>

      {/* ── Create Risk Sheet ── */}
      <SlideOutSheet
        title="Log New Risk"
        description="Identify and assess a new risk for this reporting cycle."
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
      >
        <RiskForm
          key={isCreateSheetOpen ? "create-open" : "create-closed"}
          isEditMode={false}
          processes={processes}
          availableObjectives={availableObjectives}
          onCancel={() => setIsCreateSheetOpen(false)}
          onSubmit={handleCreate}
        />
      </SlideOutSheet>

      {/* ── Custom Update Alert Dialog ── */}
      {riskToUpdate && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Confirm Update</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You are about to update <strong className="text-slate-900 dark:text-slate-100">{riskToUpdate.title}</strong> for <strong className="text-slate-900 dark:text-slate-100">{periodLabel}</strong>. This change will be logged in the audit trail.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setRiskToUpdate(null)}>
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
