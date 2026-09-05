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
import { Layers } from "lucide-react"

// ── Re-export types so the page can import from one place ──

export type ObjectiveStatus = "On Track" | "At Risk" | "Off Track" | "Achieved"

export interface ObjectiveFormData {
  id?: string
  processName: string
  name: string
  description: string
  targetDate: string
  status: ObjectiveStatus
  linkedKpis: string[]
}

// ── Available KPI shape (injected by the parent page) ──

export interface AvailableKpi {
  name: string
  processName: string
}

interface ObjectiveFormProps {
  initialData?: ObjectiveFormData | null
  isEditMode?: boolean
  readOnly?: boolean
  processes?: string[]
  availableKpis?: AvailableKpi[]
  onSubmit: (data: ObjectiveFormData) => void
  onCancel: () => void
}

export default function ObjectiveForm({
  initialData,
  isEditMode = false,
  readOnly = false,
  processes = [],
  availableKpis = [],
  onSubmit,
  onCancel,
}: ObjectiveFormProps) {
  const [formData, setFormData] = useState<ObjectiveFormData>(() => {
    if (initialData) return initialData
    return {
      processName: processes[0] ?? "",
      name: "",
      description: "",
      targetDate: "",
      status: "On Track",
      linkedKpis: [],
    }
  })

  const handleStatusChange = (status: ObjectiveStatus) => {
    setFormData({ ...formData, status })
  }

  const toggleKpi = (kpiName: string) => {
    setFormData(prev => ({
      ...prev,
      linkedKpis: prev.linkedKpis.includes(kpiName)
        ? prev.linkedKpis.filter(k => k !== kpiName)
        : [...prev.linkedKpis, kpiName],
    }))
  }

  // Filter available KPIs to the selected process
  const filteredKpis = availableKpis.filter(
    kpi => kpi.processName === formData.processName
  )

  return (
    <div className="space-y-6">

      {/* Process */}
      <div className="space-y-2">
        <Label>
          Process <span className="text-rose-500">*</span>
        </Label>
        {isEditMode ? (
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            <Layers className="h-4 w-4 text-muted-foreground" />
            {formData.processName || "—"}
          </div>
        ) : processes.length > 0 ? (
          <Select
            value={formData.processName}
            onValueChange={(val) => setFormData({ ...formData, processName: val ?? "", linkedKpis: [] })}
          >
            <SelectTrigger className="w-full">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select a process" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {processes.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            placeholder="e.g., Service Delivery"
            value={formData.processName}
            onChange={(e) => setFormData({ ...formData, processName: e.target.value })}
          />
        )}
      </div>

      {/* Objective Name */}
      <div className="space-y-2">
        <Label htmlFor="obj-name">
          Objective Name <span className="text-rose-500">*</span>
        </Label>
        {isEditMode ? (
          <div className="font-medium">{formData.name}</div>
        ) : (
          <Input
            id="obj-name"
            placeholder="e.g., Achieve 99.9% System Uptime"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="obj-desc">Description</Label>
        {readOnly ? (
          <p className="text-sm text-muted-foreground">{formData.description || "—"}</p>
        ) : (
          <textarea
            id="obj-desc"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            placeholder="Describe the objective and expected outcome..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        )}
      </div>

      {/* Target Date */}
      <div className="space-y-2">
        <Label>
          Target Date <span className="text-rose-500">*</span>
        </Label>
        {isEditMode || readOnly ? (
          <div className="text-sm font-medium">{formData.targetDate || "—"}</div>
        ) : (
          <div className="flex items-center gap-2">
            <Select
              value={formData.targetDate.split(" ")[0] || ""}
              onValueChange={(val) => {
                const year = formData.targetDate.split(" ")[1] || new Date().getFullYear().toString()
                setFormData({ ...formData, targetDate: val ? `${val} ${year}` : "" })
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Quarter" />
              </SelectTrigger>
              <SelectContent>
                {["Q1","Q2","Q3","Q4"].map((q) => (
                  <SelectItem key={q} value={q}>{q}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={formData.targetDate.split(" ")[1] || ""}
              onValueChange={(val) => {
                const quarter = formData.targetDate.split(" ")[0] || "Q1"
                setFormData({ ...formData, targetDate: val ? `${quarter} ${val}` : "" })
              }}
            >
              <SelectTrigger className="w-[100px]">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() + i).toString()).map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* Status */}
      <div className="space-y-3">
        <Label>{isEditMode ? "Status" : "Initial Status"}</Label>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={formData.status === "On Track" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "On Track" ? "bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/50 dark:text-blue-400 dark:hover:bg-blue-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("On Track")}
          >
            On Track
          </Badge>
          <Badge
            variant={formData.status === "At Risk" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "At Risk" ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("At Risk")}
          >
            At Risk
          </Badge>
          <Badge
            variant={formData.status === "Off Track" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "Off Track" ? "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("Off Track")}
          >
            Off Track
          </Badge>
          <Badge
            variant={formData.status === "Achieved" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "Achieved" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("Achieved")}
          >
            Achieved
          </Badge>
        </div>
      </div>

      {/* Linked KPIs — toggle chips */}
      <div className="space-y-3">
        <Label>Linked KPIs</Label>
        <p className="text-xs text-muted-foreground -mt-1">
          {readOnly
            ? "KPIs associated with this objective."
            : "Select the KPIs that measure this objective's progress."
          }
        </p>
        <div className="flex flex-wrap gap-2">
          {filteredKpis.length > 0 ? filteredKpis.map((kpi) => {
            const isSelected = formData.linkedKpis.includes(kpi.name)
            return (
              <Badge
                key={kpi.name}
                variant={isSelected ? "default" : "outline"}
                className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${isSelected ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
                onClick={() => !readOnly && toggleKpi(kpi.name)}
              >
                {kpi.name}
              </Badge>
            )
          }) : (
            <p className="text-sm text-muted-foreground">
              {formData.processName ? "No KPIs found for this process." : "Select a process first."}
            </p>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t dark:border-zinc-800">
        {readOnly ? (
          <Button variant="outline" onClick={onCancel} className="w-full">Close Record</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onSubmit(formData)} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isEditMode ? "Save Changes" : "Create Objective"}
            </Button>
          </>
        )}
      </div>

    </div>
  )
}
