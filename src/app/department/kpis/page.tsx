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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"

const initialData = [
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
    actual: "2.5 Hours",
    status: "Achieved",
    justification: "",
  },
]

export default function KPITrackingPage() {
  const [data, setData] = useState(initialData)
  
  // Modals & Sheets State
  const [kpiToDelete, setKpiToDelete] = useState<typeof initialData[0] | null>(null)
  const [kpiToEdit, setKpiToEdit] = useState<typeof initialData[0] | null>(null)
  const [kpiToUpdate, setKpiToUpdate] = useState<typeof initialData[0] | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)
  
  // Create KPI Form State
  const [newKpi, setNewKpi] = useState({
    name: "",
    target: "",
    status: "Pending",
  })

  const handleCreate = () => {
    if (!newKpi.name.trim() || !newKpi.target.trim()) {
      toast.error("Please fill in both the KPI description and target.")
      return
    }
    
    const createdKpi = {
      id: `kpi-${Date.now()}`,
      name: newKpi.name,
      target: newKpi.target,
      actual: "",
      status: newKpi.status,
      justification: "",
    }
    
    setData([...data, createdKpi])
    setIsCreateSheetOpen(false)
    setNewKpi({ name: "", target: "", status: "Pending" })
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

      {/* ── Create KPI Sheet ── */}
      <Sheet open={isCreateSheetOpen} onOpenChange={setIsCreateSheetOpen}>
        <SheetContent className="sm:max-w-[425px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Create New KPI</SheetTitle>
            <SheetDescription>
              Define a new Key Performance Indicator for this reporting cycle.
            </SheetDescription>
          </SheetHeader>
          
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="create-name">
                KPI Description <span className="text-rose-500">*</span>
              </Label>
              <Input 
                id="create-name" 
                placeholder="e.g., Mean Time to Resolve (MTTR)" 
                value={newKpi.name}
                onChange={(e) => setNewKpi({ ...newKpi, name: e.target.value })}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="create-target">
                Target Value <span className="text-rose-500">*</span>
              </Label>
              <Input 
                id="create-target" 
                placeholder="e.g., < 4 Hours" 
                value={newKpi.target}
                onChange={(e) => setNewKpi({ ...newKpi, target: e.target.value })}
              />
            </div>

            <div className="space-y-3">
              <Label>Initial Status</Label>
              <div className="flex flex-wrap gap-2">
                <Badge 
                  variant={newKpi.status === "Achieved" ? "default" : "outline"}
                  className={`cursor-pointer transition-colors px-3 py-1 ${newKpi.status === "Achieved" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
                  onClick={() => setNewKpi({ ...newKpi, status: "Achieved" })}
                >
                  Achieved
                </Badge>
                <Badge 
                  variant={newKpi.status === "Deviated" ? "default" : "outline"}
                  className={`cursor-pointer transition-colors px-3 py-1 ${newKpi.status === "Deviated" ? "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
                  onClick={() => setNewKpi({ ...newKpi, status: "Deviated" })}
                >
                  Deviated
                </Badge>
                <Badge 
                  variant={newKpi.status === "Pending" ? "default" : "outline"}
                  className={`cursor-pointer transition-colors px-3 py-1 ${newKpi.status === "Pending" ? "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
                  onClick={() => setNewKpi({ ...newKpi, status: "Pending" })}
                >
                  Pending
                </Badge>
              </div>
            </div>
          </div>
          
          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setIsCreateSheetOpen(false)}>Cancel</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleCreate}>
              Create KPI
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Edit KPI Sheet ── */}
      <Sheet open={!!kpiToEdit} onOpenChange={(isOpen) => !isOpen && setKpiToEdit(null)}>
        <SheetContent className="sm:max-w-[425px] overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>Update Measurement</SheetTitle>
            <SheetDescription>
              Input the quarterly actuals and justification for {kpiToEdit?.name}.
            </SheetDescription>
          </SheetHeader>
          
          {kpiToEdit && (
            <div className="space-y-6">
              <div className="space-y-2">
                <Label className="text-muted-foreground">KPI Description</Label>
                <div className="font-medium">{kpiToEdit.name}</div>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground">Target Value</Label>
                <div className="font-medium">{kpiToEdit.target}</div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="actual">Actual Value</Label>
                <Input id="actual" defaultValue={kpiToEdit.actual} />
              </div>

              <div className="space-y-3">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  <Badge 
                    variant={kpiToEdit.status === "Achieved" ? "default" : "outline"}
                    className={`cursor-pointer transition-colors px-3 py-1 ${kpiToEdit.status === "Achieved" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
                    onClick={() => setKpiToEdit({ ...kpiToEdit, status: "Achieved" })}
                  >
                    Achieved
                  </Badge>
                  <Badge 
                    variant={kpiToEdit.status === "Deviated" ? "default" : "outline"}
                    className={`cursor-pointer transition-colors px-3 py-1 ${kpiToEdit.status === "Deviated" ? "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
                    onClick={() => setKpiToEdit({ ...kpiToEdit, status: "Deviated" })}
                  >
                    Deviated
                  </Badge>
                  <Badge 
                    variant={kpiToEdit.status === "Pending" ? "default" : "outline"}
                    className={`cursor-pointer transition-colors px-3 py-1 ${kpiToEdit.status === "Pending" ? "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
                    onClick={() => setKpiToEdit({ ...kpiToEdit, status: "Pending" })}
                  >
                    Pending
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="justification">Justification for Deviation</Label>
                <Input id="justification" defaultValue={kpiToEdit.justification} placeholder="Explain why the target was missed..." />
              </div>
            </div>
          )}
          
          <SheetFooter className="mt-8">
            <Button variant="outline" onClick={() => setKpiToEdit(null)}>Cancel</Button>
            <Button onClick={() => setKpiToUpdate(kpiToEdit)}>Save Changes</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Custom Update Alert Dialog (Brick 4) ── */}
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
