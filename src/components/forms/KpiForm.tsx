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

export type KpiStatus = "Achieved" | "Deviated" | "Pending"

export interface KpiFormData {
  id?: string;
  processName: string;
  name: string;
  target: string;
  actual?: string;
  status: KpiStatus;
  justification?: string;
}

interface KpiFormProps {
  initialData?: KpiFormData | null;
  isEditMode?: boolean;
  readOnly?: boolean;
  processes?: string[]; // Injected by the parent page — department-specific
  onSubmit: (data: KpiFormData) => void;
  onCancel: () => void;
}

export default function KpiForm({ initialData, isEditMode = false, readOnly = false, processes = [], onSubmit, onCancel }: KpiFormProps) {
  const [formData, setFormData] = useState<KpiFormData>(() => {
    if (initialData) return initialData;
    return {
      processName: processes[0] ?? "",
      name: "",
      target: "",
      actual: "",
      status: "Pending",
      justification: "",
    };
  })

  const handleStatusChange = (status: KpiStatus) => {
    setFormData({ ...formData, status })
  }

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
            onValueChange={(val) => setFormData({ ...formData, processName: val ?? "" })}
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

      {/* KPI Description */}
      <div className="space-y-2">
        <Label htmlFor="kpi-name">
          KPI Description <span className="text-rose-500">*</span>
        </Label>
        {isEditMode ? (
          <div className="font-medium">{formData.name}</div>
        ) : (
          <Input
            id="kpi-name"
            placeholder="e.g., Customer Churn Rate"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        )}
      </div>

      {/* Target Value */}
      <div className="space-y-2">
        <Label htmlFor="kpi-target">
          Target Value <span className="text-rose-500">*</span>
        </Label>
        {isEditMode ? (
          <div className="font-medium">{formData.target}</div>
        ) : (
          <Input
            id="kpi-target"
            placeholder="e.g., < 5%"
            value={formData.target}
            onChange={(e) => setFormData({ ...formData, target: e.target.value })}
          />
        )}
      </div>

      {/* Actual Value — edit mode only */}
      {isEditMode && (
        <div className="space-y-2">
          <Label htmlFor="kpi-actual">Actual Value</Label>
          <Input
            id="kpi-actual"
            defaultValue={formData.actual}
            onChange={(e) => setFormData({ ...formData, actual: e.target.value })}
          />
        </div>
      )}

      {/* Status */}
      <div className="space-y-3">
        <Label>{isEditMode ? "Status" : "Initial Status"}</Label>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={formData.status === "Achieved" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "Achieved" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("Achieved")}
          >
            Achieved
          </Badge>
          <Badge
            variant={formData.status === "Deviated" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "Deviated" ? "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("Deviated")}
          >
            Deviated
          </Badge>
          <Badge
            variant={formData.status === "Pending" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "Pending" ? "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("Pending")}
          >
            Pending
          </Badge>
        </div>
      </div>

      {/* Justification — edit mode only */}
      {isEditMode && (
        <div className="space-y-2">
          <Label htmlFor="kpi-justification">Justification for Deviation</Label>
          <Input
            id="kpi-justification"
            defaultValue={formData.justification}
            placeholder="Explain why the target was missed..."
            onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
          />
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t dark:border-zinc-800">
        {readOnly ? (
          <Button variant="outline" onClick={onCancel} className="w-full">Close Record</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onSubmit(formData)} className="bg-blue-600 hover:bg-blue-700 text-white">
              {isEditMode ? "Save Changes" : "Create KPI"}
            </Button>
          </>
        )}
      </div>

    </div>
  )
}



