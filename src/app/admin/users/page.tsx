"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Users, Trash2, Edit2, Shield } from "lucide-react"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import SlideOutSheet from "@/components/shared/SlideOutSheet"
import UserForm, { UserFormData, SystemRole } from "@/components/forms/UserForm"

// ── Role Badge Component ──

function RoleBadge({ role }: { role: SystemRole }) {
  switch (role) {
    case "SUPER_ADMIN":
      return <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400 gap-1 text-xs"><Shield className="h-3 w-3" />Super Admin</Badge>
    case "DEPT_HEAD":
      return <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100 dark:bg-indigo-900/40 dark:text-indigo-400 text-xs">Dept Head</Badge>
    case "CONTRIBUTOR":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-900/40 dark:text-blue-400 text-xs">Contributor</Badge>
    case "VIEWER":
      return <Badge className="bg-slate-200 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 text-xs">Viewer</Badge>
  }
}

// ── Mock Departments ──

const departments = [
  { id: "dept-1", name: "Service Delivery" },
  { id: "dept-2", name: "Incident Management" },
  { id: "dept-3", name: "Change Management" },
  { id: "dept-4", name: "Human Resources" },
]

// ── Mock Users ──

const initialUsers: UserFormData[] = [
  {
    id: "usr-1",
    fullName: "Nahom Tesfaye",
    email: "nahom@company.com",
    jobTitle: "Frontend Lead",
    departmentId: "dept-1",
    systemRole: "SUPER_ADMIN",
    status: "Active",
  },
  {
    id: "usr-2",
    fullName: "Sarah Mengistu",
    email: "sarah@company.com",
    jobTitle: "Engineering Manager",
    departmentId: "dept-2",
    systemRole: "DEPT_HEAD",
    status: "Active",
  },
  {
    id: "usr-3",
    fullName: "David Haile",
    email: "david@company.com",
    jobTitle: "Head of Service Delivery",
    departmentId: "dept-1",
    systemRole: "DEPT_HEAD",
    status: "Active",
  },
  {
    id: "usr-4",
    fullName: "Elena Tadesse",
    email: "elena@company.com",
    jobTitle: "VP of Operations",
    departmentId: "dept-3",
    systemRole: "CONTRIBUTOR",
    status: "Active",
  },
  {
    id: "usr-5",
    fullName: "Amir Kebede",
    email: "amir@company.com",
    jobTitle: "Junior Analyst",
    departmentId: "dept-4",
    systemRole: "VIEWER",
    status: "Suspended",
  },
]

// ── Page Component ──

export default function UsersPage() {
  const [data, setData] = useState<UserFormData[]>(initialUsers)

  // Modals & Sheets State
  const [userToDelete, setUserToDelete] = useState<UserFormData | null>(null)
  const [userToEdit, setUserToEdit] = useState<UserFormData | null>(null)
  const [isCreateSheetOpen, setIsCreateSheetOpen] = useState(false)

  // ── Handlers ──

  const handleCreate = (formData: UserFormData) => {
    if (!formData.fullName.trim() || !formData.email.trim()) {
      toast.error("Full Name and Email are required.")
      return
    }
    if (!formData.departmentId) {
      toast.error("Please assign a department.")
      return
    }
    const created: UserFormData = {
      ...formData,
      id: `usr-${Date.now()}`,
    }
    setData([...data, created])
    setIsCreateSheetOpen(false)
    toast.success(`User "${created.fullName}" has been created.`)
  }

  const handleUpdate = (formData: UserFormData) => {
    setData(data.map(u => u.id === formData.id ? formData : u))
    setUserToEdit(null)
    toast.success(`User "${formData.fullName}" has been updated.`)
  }

  const handleDelete = () => {
    if (userToDelete) {
      setData(data.filter(u => u.id !== userToDelete.id))
      toast.success(`User "${userToDelete.fullName}" has been removed.`)
      setUserToDelete(null)
    }
  }

  // Helper: resolve department name from ID
  const getDeptName = (id: string) => departments.find(d => d.id === id)?.name || "—"

  return (
    <div className="flex-1 p-4 md:p-6 space-y-6 w-full max-w-[1600px] mx-auto relative">

      {/* ── Page Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-indigo-600 dark:text-indigo-500" />
            <h1 className="text-2xl font-bold tracking-tight">Users & Roles</h1>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Manage user accounts, assign departments, and configure system-level access roles.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="bg-blue-600 hover:bg-blue-700 text-white gap-2 h-9"
            onClick={() => setIsCreateSheetOpen(true)}
          >
            <Plus className="h-4 w-4" />
            New User
          </Button>
        </div>
      </div>

      {/* ── Users Data Table ── */}
      <div className="rounded-md border bg-white dark:bg-zinc-950 shadow-sm overflow-hidden">
        <Table>
          <TableHeader className="bg-slate-50 dark:bg-zinc-900/50">
            <TableRow>
              <TableHead className="h-10 pl-6">User</TableHead>
              <TableHead className="h-10">Department</TableHead>
              <TableHead className="h-10">System Role</TableHead>
              <TableHead className="h-10">Status</TableHead>
              <TableHead className="h-10 text-right pr-6">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  No users configured.
                </TableCell>
              </TableRow>
            ) : (
              data.map((row) => (
                <TableRow
                  key={row.id}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-900/50 ${row.status === "Suspended" ? "opacity-60" : ""}`}
                >
                  <TableCell className="font-medium pl-6">
                    <div>
                      {row.fullName}
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground font-normal">{row.email}</p>
                        {row.jobTitle && (
                          <span className="text-xs text-muted-foreground/70">· {row.jobTitle}</span>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getDeptName(row.departmentId)}
                  </TableCell>
                  <TableCell>
                    <RoleBadge role={row.systemRole} />
                  </TableCell>
                  <TableCell>
                    {row.status === "Active" ? (
                      <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/40 dark:text-emerald-400">
                        Active
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-100 text-rose-800 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-400">
                        Suspended
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                        title="Edit User"
                        onClick={() => setUserToEdit(row)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                        title="Delete User"
                        onClick={() => setUserToDelete(row)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* ── Custom Delete Alert Dialog ── */}
      {userToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg shadow-lg w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-lg font-bold tracking-tight mb-2">Are you sure?</h2>
            <p className="text-sm text-muted-foreground mb-6">
              You are about to permanently remove <strong className="text-slate-900 dark:text-slate-100">{userToDelete.fullName}</strong> ({userToDelete.email}). They will lose all access to the IMS portal.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setUserToDelete(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Remove User
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit User Sheet ── */}
      <SlideOutSheet
        title="Edit User"
        description="Update user details, department assignment, and system role."
        isOpen={!!userToEdit}
        onClose={() => setUserToEdit(null)}
      >
        <UserForm
          key={userToEdit?.id ?? "edit-closed"}
          initialData={userToEdit}
          isEditMode={true}
          departments={departments}
          onCancel={() => setUserToEdit(null)}
          onSubmit={handleUpdate}
        />
      </SlideOutSheet>

      {/* ── Create User Sheet ── */}
      <SlideOutSheet
        title="Create User"
        description="Add a new user to the IMS portal and assign their access level."
        isOpen={isCreateSheetOpen}
        onClose={() => setIsCreateSheetOpen(false)}
      >
        <UserForm
          key={isCreateSheetOpen ? "create-open" : "create-closed"}
          isEditMode={false}
          departments={departments}
          onCancel={() => setIsCreateSheetOpen(false)}
          onSubmit={handleCreate}
        />
      </SlideOutSheet>

    </div>
  )
}
