"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, FileSpreadsheet, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import SlideOutSheet from "@/components/shared/SlideOutSheet"
import KpiForm, { KpiFormData } from "@/components/forms/KpiForm"

const initialData: KpiFormData[] = [
  {
    id: "kpi-1",
    name: "Latency",
    target: "< 170ms",
    actual: "96.733 ms",
    status: "Achieved",
    justification: "",
  },
  {
    id: "kpi-2",
    name: "System Uptime (Availability)",
    target: "99.9%",
    actual: "98.2%",
    status: "Deviated",
    justification: "Core router failure on Mar 12th resulted in 4 hours downtime.",
  },
  {
    id: "kpi-3",
    name: "Mean Time to Resolve (MTTR)",
    target: "< 4 Hours",
    actual: "",
    status: "Pending",
    justification: "",
  },
]

export default function KPITrackingPage() {
  const [data, setData] = useState<KpiFormData[]>(initialData)
  
  // Modals & Sheets State
  const [kpiToDelete, setKpiToDelete] = useState<KpiFormData | null>(null)
  const [kpiToEdit, setKpiToEdit] = useState<KpiFormData | null>(null)
  const [kpiToUpdate, setKpiToUpdate] = useState<KpiFormData | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  const handleCreate = (formData: KpiFormData) => {
    if (!formData.name.trim() || !formData.target.trim()) {
      toast.error("Please fill in both the KPI description and target.")
      return
    }
    
    const createdKpi = {
      id: `kpi-${Date.now()}`,
      name: formData.name,
      target: formData.target,
      actual: "",
      status: formData.status as "Achieved" | "Deviated" | "Pending",
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

  // Called when a user clicks a row
  const handleRowClick = (kpi: typeof initialData[0]) => {
    setKpiToEdit(kpi)
  }

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
        <div className="flex items-center gap-3">
          <Button 
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
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
              <TableHead className="h-10">KPI Description</TableHead>
              <TableHead className="h-10">Target Value</TableHead>
              <TableHead className="h-10">Actual Value</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10">Justification</TableHead>
              <TableHead className="h-10 w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow 
                key={row.id} 
                onClick={() => handleRowClick(row)}
                className="hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors cursor-pointer"
              >
                <TableCell className="font-medium max-w-[250px] truncate" title={row.name}>
                  {row.name}
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
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors z-10 relative"
                    title="Delete KPI"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevents the row click (Edit Sheet) from firing
                      setKpiToDelete(row);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
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
          isEditMode={false}
          onCancel={() => setIsCreateSheetOpen(false)}
          onSubmit={handleCreate}
        />
      </SlideOutSheet>

      {/* ── Edit KPI Sheet (Refactored) ── */}
      <SlideOutSheet
        title="Update Measurement"
        description={`Input the quarterly actuals and justification for ${kpiToEdit?.name}.`}
        isOpen={!!kpiToEdit}
        onClose={() => setKpiToEdit(null)}
      >
        <KpiForm 
          initialData={kpiToEdit}
          isEditMode={true}
          onCancel={() => setKpiToEdit(null)}
          onSubmit={(data) => setKpiToUpdate(data)}
        />
      </SlideOutSheet>

      {/* ── Custom Update Alert Dialog ── */}
      {kpiToUpdate && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Confirm Update</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You are about to change <strong className="text-slate-900 dark:text-slate-100">{kpiToUpdate.name}</strong> for Q1 2026. This change will be logged in the audit trail.
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
