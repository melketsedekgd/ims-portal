"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Building2, Trash2, ChevronLeft, ChevronRight } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import SlideOutSheet from "@/components/shared/SlideOutSheet"
import DepartmentForm, { DepartmentFormData } from "@/components/forms/DepartmentForm"

// ── Mock Data ──

const mockUsers = [
  { id: "usr-1", name: "Nahom (Frontend Lead)" },
  { id: "usr-2", name: "Sarah (Engineering Manager)" },
  { id: "usr-3", name: "David (Head of Service Delivery)" },
  { id: "usr-4", name: "Elena (VP of Operations)" },
]

const initialDepartments: DepartmentFormData[] = [
  {
    id: "dept-1",
    name: "Service Delivery",
    code: "SRV",
    description: "Responsible for maintaining core router infrastructure and uptime.",
    headOfDepartment: "usr-3",
    status: "Active",
    workflowSteps: ["Writer", "IMS Manager", "VP", "Published"],
  },
  {
    id: "dept-2",
    name: "Incident Management",
    code: "INC",
    description: "Handles paging, on-call rotations, and incident response SLAs.",
    headOfDepartment: "usr-2",
    status: "Active",
    workflowSteps: ["Writer", "IMS Manager", "VP", "Published"],
  },
  {
    id: "dept-3",
    name: "Change Management",
    code: "CHG",
    description: "Review and approve architectural changes and rollback plans.",
    headOfDepartment: "usr-4",
    status: "Active",
    workflowSteps: ["Writer", "IMS Manager", "VP", "Published"],
  },
  {
    id: "dept-4",
    name: "Legacy Hardware",
    code: "LGY",
    description: "Phased out physical datacenter operations.",
    headOfDepartment: "",
    status: "Inactive",
    workflowSteps: ["Writer", "IMS Manager", "VP", "Published"],
  },
]

// ── Page Component ──

export default function DepartmentsPage() {
  const [data, setData] = useState<DepartmentFormData[]>(initialDepartments)

  // Modals & Sheets State
  const [deptToDelete, setDeptToDelete] = useState<DepartmentFormData | null>(null)
  const [deptToEdit, setDeptToEdit] = useState<DepartmentFormData | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 8
  const totalPages = Math.ceil(data.length / pageSize)
  const paginatedData = data.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // ── Handlers ──
  
  const handleCreate = (formData: DepartmentFormData) => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Department Name and Code are required.")
      return
    }
    const created: DepartmentFormData = {
      ...formData,
      id: `dept-${Date.now()}`,
    }
    setData([...data, created])
    setIsCreateSheetOpen(false)
    toast.success(`Department "${created.name}" has been created.`)
  }

  const handleUpdate = (formData: DepartmentFormData) => {
    if (!formData.name.trim() || !formData.code.trim()) {
      toast.error("Department Name and Code are required.")
      return
    }
    setData(data.map(d => d.id === formData.id ? formData : d))
    setDeptToEdit(null)
    toast.success(`Department "${formData.name}" has been updated.`)
  }

  const handleDelete = () => {
    if (deptToDelete) {
      setData(data.filter(d => d.id !== deptToDelete.id))
      toast.success(`Department "${deptToDelete.name}" deleted.`)
      setDeptToDelete(null)
    }
  }

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">
      
      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-500" />
            <h1 className="text-2xl font-bold tracking-tight">Department Management</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Configure organizational units that structure Objectives and KPIs.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9"
            onClick={() => setIsCreateSheetOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New Department
          </Button>
        </div>
      </div>

      {/* ── Departments Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">Department</TableHead>
              <TableHead className="h-10">Code</TableHead>
              <TableHead className="h-10">Head of Department</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10 w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No departments configured.
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.map((row) => (
                <TableRow 
                  key={row.id}
                  onClick={() => setDeptToEdit(row)}
                  className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/50 ${row.status === "Inactive" ? "opacity-60" : ""}`}
                >
                  <TableCell className="font-medium pl-6">
                    <div>
                      {row.name}
                      {row.description && (
                        <p className="text-xs text-muted-foreground font-normal truncate max-w-[300px]">
                          {row.description}
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs text-slate-500">
                      {row.code}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.headOfDepartment ? (
                      <span className="text-sm">{mockUsers.find(u => u.id === row.headOfDepartment)?.name || "Unknown"}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground italic">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.status === "Active" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-800">
                        Inactive
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors z-10 relative"
                      title="Delete Department"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeptToDelete(row)
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50/50 dark:bg-zinc-900/30">
            <p className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, data.length)} of {data.length}
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(currentPage - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium px-2 text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(currentPage + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Custom Delete Alert Dialog ── */}
      {deptToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Are you sure?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You are about to delete the <strong className="text-slate-900 dark:text-slate-100">{deptToDelete.name}</strong> department. Users assigned to this department may lose their access context.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setDeptToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Department
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Department Sheet ── */}
      <SlideOutSheet
        title="Edit Department"
        description="Update department configuration and leadership."
        isOpen={!!deptToEdit}
        onClose={() => setDeptToEdit(null)}
      >
        <DepartmentForm
          key={deptToEdit?.id ?? "edit-closed"}
          initialData={deptToEdit}
          isEditMode={true}
          availableUsers={mockUsers}
          onCancel={() => setDeptToEdit(null)}
          onSubmit={handleUpdate}
        />
      </SlideOutSheet>

      {/* ── Create Department Sheet ── */}
      <SlideOutSheet
        title="Create Department"
        description="Configure a new organizational unit."
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
      >
        <DepartmentForm
          key={isCreateSheetOpen ? "create-open" : "create-closed"}
          isEditMode={false}
          availableUsers={mockUsers}
          onCancel={() => setIsCreateSheetOpen(false)}
          onSubmit={handleCreate}
        />
      </SlideOutSheet>

    </div>
  )
}
