"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

export type KpiStatus = "Achieved" | "Deviated" | "Pending"

export interface KpiFormData {
  id?: string;
  name: string;
  target: string;
  actual?: string;
  status: KpiStatus;
  justification?: string;
}

interface KpiFormProps {
  initialData?: KpiFormData | null;
  isEditMode?: boolean;
  onSubmit: (data: KpiFormData) => void;
  onCancel: () => void;
}

export default function KpiForm({ initialData, isEditMode = false, onSubmit, onCancel }: KpiFormProps) {
  const [formData, setFormData] = useState<KpiFormData>({
    name: "",
    target: "",
    actual: "",
    status: "Pending",
    justification: "",
  })

  // Sync with initialData (e.g. when opening the edit sheet)
  useEffect(() => {
    if (initialData) {
      setFormData(initialData)
    } else {
      setFormData({ name: "", target: "", actual: "", status: "Pending", justification: "" })
    }
  }, [initialData])

  const handleStatusChange = (status: KpiStatus) => {
    setFormData({ ...formData, status })
  }

  return (
    <div className="space-y-6">
      
      {/* Name / Description */}
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

      {/* Actual Value (Only relevant during Edit/Update mode) */}
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

      {/* Interactive Status Selector */}
      <div className="space-y-3">
        <Label>{isEditMode ? "Status" : "Initial Status"}</Label>
        <div className="flex flex-wrap gap-2">
          <Badge 
            variant={formData.status === "Achieved" ? "default" : "outline"}
            className={`cursor-pointer transition-colors px-3 py-1 ${formData.status === "Achieved" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => handleStatusChange("Achieved")}
          >
            Achieved
          </Badge>
          <Badge 
            variant={formData.status === "Deviated" ? "default" : "outline"}
            className={`cursor-pointer transition-colors px-3 py-1 ${formData.status === "Deviated" ? "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => handleStatusChange("Deviated")}
          >
            Deviated
          </Badge>
          <Badge 
            variant={formData.status === "Pending" ? "default" : "outline"}
            className={`cursor-pointer transition-colors px-3 py-1 ${formData.status === "Pending" ? "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => handleStatusChange("Pending")}
          >
            Pending
          </Badge>
        </div>
      </div>

      {/* Justification (Only relevant during Edit/Update mode) */}
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

      {/* Footer Actions */}
      <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t dark:border-zinc-800">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSubmit(formData)} className="bg-blue-600 hover:bg-blue-700 text-white">
          {isEditMode ? "Save Changes" : "Create KPI"}
        </Button>
      </div>

    </div>
  )
}
