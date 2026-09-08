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
import { Plus, Trash2, GitMerge } from "lucide-react"

export type DepartmentStatus = "Active" | "Inactive"

export interface DepartmentFormData {
  id?: string
  name: string
  code: string
  description: string
  headOfDepartment: string
  status: DepartmentStatus
  workflowSteps: string[]
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
      workflowSteps: ["Writer", "IMS Manager", "VP", "Published"],
    }
  })

  const addWorkflowStep = () => {
    // Insert before "Published" if possible
    const steps = [...formData.workflowSteps]
    if (steps.length > 0 && steps[steps.length - 1] === "Published") {
      steps.splice(steps.length - 1, 0, "New Approver")
    } else {
      steps.push("New Approver")
    }
    setFormData({ ...formData, workflowSteps: steps })
  }

  const removeWorkflowStep = (index: number) => {
    const steps = [...formData.workflowSteps]
    steps.splice(index, 1)
    setFormData({ ...formData, workflowSteps: steps })
  }

  const updateWorkflowStep = (index: number, value: string) => {
    const steps = [...formData.workflowSteps]
    steps[index] = value
    setFormData({ ...formData, workflowSteps: steps })
  }

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

      {/* ── Workflow JSON Array Builder ── */}
      <div className="space-y-3 pt-4 border-t dark:border-zinc-800">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="flex items-center gap-1.5">
              <GitMerge className="h-4 w-4 text-blue-500" />
              Approval Routing Workflow
            </Label>
            <p className="text-xs text-muted-foreground">
              Define the multi-step sequence for KPI and Objective approvals in this department.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addWorkflowStep} className="h-8 gap-1 text-xs">
            <Plus className="h-3 w-3" /> Add Step
          </Button>
        </div>
        
        <div className="bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-md p-3 space-y-2">
          {formData.workflowSteps.map((step, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-slate-200 dark:bg-zinc-800 text-xs font-medium text-slate-500 shrink-0">
                {index + 1}
              </div>
              <Input 
                value={step}
                className="h-8 text-sm"
                readOnly={index === 0 || index === formData.workflowSteps.length - 1}
                onChange={(e) => updateWorkflowStep(index, e.target.value)}
              />
              {index !== 0 && index !== formData.workflowSteps.length - 1 && (
                <Button 
                  type="button" 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 shrink-0 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                  onClick={() => removeWorkflowStep(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <div className="flex justify-center py-1">
            <div className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">
              End of Workflow
            </div>
          </div>
        </div>
      </div>

      {/* Status */}
      <div className="space-y-3 pt-4 border-t dark:border-zinc-800">
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
