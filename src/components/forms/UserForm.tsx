"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ── Types ──

export type SystemRole = "SUPER_ADMIN" | "DEPT_HEAD" | "CONTRIBUTOR" | "VIEWER"
export type UserStatus = "Active" | "Suspended"

export interface UserFormData {
  id?: string
  fullName: string
  email: string
  jobTitle: string
  departmentId: string
  systemRole: SystemRole
  status: UserStatus
}

export interface AvailableDepartment {
  id: string
  name: string
}

interface UserFormProps {
  initialData?: UserFormData | null
  isEditMode?: boolean
  departments?: AvailableDepartment[]
  onSubmit: (data: UserFormData) => void
  onCancel: () => void
}

// ── Role metadata for display ──

const roleConfig: Record<SystemRole, { label: string; description: string; color: string; activeColor: string }> = {
  SUPER_ADMIN: {
    label: "Super Admin",
    description: "Full system access. Can manage departments, users, and all settings.",
    color: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500",
    activeColor: "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/70 shadow-none border-transparent",
  },
  DEPT_HEAD: {
    label: "Department Head",
    description: "Full access to their department. Can publish reports and lock records.",
    color: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500",
    activeColor: "bg-indigo-100 text-indigo-800 hover:bg-indigo-200 dark:bg-indigo-900/50 dark:text-indigo-400 dark:hover:bg-indigo-900/70 shadow-none border-transparent",
  },
  CONTRIBUTOR: {
    label: "Contributor",
    description: "Can create and update Objectives, KPIs, and Risks in their department.",
    color: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500",
    activeColor: "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/70 shadow-none border-transparent",
  },
  VIEWER: {
    label: "Viewer",
    description: "Read-only access to dashboards and reports in their department.",
    color: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500",
    activeColor: "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 shadow-none border-transparent",
  },
}

const allRoles: SystemRole[] = ["SUPER_ADMIN", "DEPT_HEAD", "CONTRIBUTOR", "VIEWER"]

export default function UserForm({
  initialData,
  isEditMode = false,
  departments = [],
  onSubmit,
  onCancel,
}: UserFormProps) {
  const [formData, setFormData] = useState<UserFormData>(() => {
    if (initialData) return initialData
    return {
      fullName: "",
      email: "",
      jobTitle: "",
      departmentId: "",
      systemRole: "VIEWER",
      status: "Active",
    }
  })

  return (
    <div className="space-y-6">

      {/* Full Name */}
      <div className="space-y-2">
        <Label htmlFor="user-name">
          Full Name <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="user-name"
          placeholder="e.g., Nahom Tesfaye"
          value={formData.fullName}
          onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
        />
      </div>

      {/* Email */}
      <div className="space-y-2">
        <Label htmlFor="user-email">
          Email <span className="text-rose-500">*</span>
        </Label>
        <Input
          id="user-email"
          type="email"
          placeholder="e.g., nahom@company.com"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
      </div>

      {/* Job Title & Department (side by side) */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="user-title">Job Title</Label>
          <Input
            id="user-title"
            placeholder="e.g., Frontend Lead"
            value={formData.jobTitle}
            onChange={(e) => setFormData({ ...formData, jobTitle: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label>Department <span className="text-rose-500">*</span></Label>
          <Select
            value={formData.departmentId}
            onValueChange={(val) => setFormData({ ...formData, departmentId: val || "" })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select department" />
            </SelectTrigger>
            <SelectContent>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* System Role (RBAC) */}
      <div className="space-y-3">
        <Label>System Role <span className="text-rose-500">*</span></Label>
        <div className="space-y-2">
          {allRoles.map((role) => {
            const config = roleConfig[role]
            const isSelected = formData.systemRole === role
            return (
              <div
                key={role}
                onClick={() => setFormData({ ...formData, systemRole: role })}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  isSelected
                    ? "border-slate-300 dark:border-zinc-600 bg-slate-50 dark:bg-zinc-900/50 ring-1 ring-slate-300 dark:ring-zinc-600"
                    : "border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700"
                }`}
              >
                <Badge
                  variant={isSelected ? "default" : "outline"}
                  className={`px-2.5 py-0.5 text-xs shrink-0 ${isSelected ? config.activeColor : config.color}`}
                >
                  {config.label}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {config.description}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Account Status */}
      <div className="space-y-3">
        <Label>Account Status</Label>
        <div className="flex gap-2">
          <Badge
            variant={formData.status === "Active" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors cursor-pointer ${formData.status === "Active" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => setFormData({ ...formData, status: "Active" })}
          >
            Active
          </Badge>
          <Badge
            variant={formData.status === "Suspended" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors cursor-pointer ${formData.status === "Suspended" ? "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => setFormData({ ...formData, status: "Suspended" })}
          >
            Suspended
          </Badge>
        </div>
        {formData.status === "Suspended" && (
          <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">
            Suspended users cannot log in or access any resources.
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t dark:border-zinc-800">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(formData)} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isEditMode ? "Save Changes" : "Create User"}
        </Button>
      </div>
    </div>
  )
}
