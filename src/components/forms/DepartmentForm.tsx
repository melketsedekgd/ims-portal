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

export type DepartmentStatus = "Active" | "Inactive"

export interface DepartmentFormData {
  id?: string
  name: string
  code: string
  description: string
  headOfDepartment: string
  status: DepartmentStatus
}

interface DepartmentFormProps {
  initialData?: DepartmentFormData | null
  isEditMode?: boolean
  availableUsers?: { id: string; name: string }[]
  onSubmit: (data: DepartmentFormData) => void
  onCancel: () => void
}

export default function DepartmentForm({
  initialData,
  isEditMode = false,
  availableUsers = [],
  onSubmit,
  onCancel,
}: DepartmentFormProps) {
  const [formData, setFormData] = useState<DepartmentFormData>(() => {
    if (initialData) return initialData
    return {
      name: "",
      code: "",
      description: "",
      headOfDepartment: "",
      status: "Active",
    }
  })

  return (
    <div className="space-y-6">
      
      {/* Department Name & Code */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 space-y-2">
          <Label htmlFor="dept-name">
            Department Name <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="dept-name"
            placeholder="e.g., Human Resources"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dept-code">
            Code <span className="text-rose-500">*</span>
          </Label>
          <Input
            id="dept-code"
            placeholder="e.g., HR"
            className="uppercase"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
          />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="dept-desc">Description</Label>
        <textarea
          id="dept-desc"
          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-y"
          placeholder="Briefly describe the department's function..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>

      {/* Head of Department */}
      <div className="space-y-2">
        <Label>Head of Department</Label>
        <Select
          value={formData.headOfDepartment}
          onValueChange={(val) => setFormData({ ...formData, headOfDepartment: val === "unassigned" ? "" : (val || "") })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Assign a department head" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned" className="text-muted-foreground italic">Unassigned</SelectItem>
            {availableUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Status */}
      <div className="space-y-3">
        <Label>Status</Label>
        <div className="flex gap-2">
          <Badge
            variant={formData.status === "Active" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors cursor-pointer ${formData.status === "Active" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => setFormData({ ...formData, status: "Active" })}
          >
            Active
          </Badge>
          <Badge
            variant={formData.status === "Inactive" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors cursor-pointer ${formData.status === "Inactive" ? "bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => setFormData({ ...formData, status: "Inactive" })}
          >
            Inactive
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Inactive departments will be hidden from standard reporting views.
        </p>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t dark:border-zinc-800">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={() => onSubmit(formData)} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isEditMode ? "Save Changes" : "Create Department"}
        </Button>
      </div>
    </div>
  )
}
