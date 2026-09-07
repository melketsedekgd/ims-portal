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
import { Layers, Plus, Trash2, Target, Activity, AlertTriangle } from "lucide-react"

export type KpiStatus = "Achieved" | "Deviated" | "Pending"

export interface KpiFormData {
  id?: string;
  processName: string;
  name: string;
  target: string;
  actual?: string;
  status: KpiStatus;
  justification?: string;
  customFields?: { id: string; name: string; value: string }[]
}

export type KpiFormMode = "create" | "edit-plan" | "review-progress" | "view-all"

interface KpiFormProps {
  initialData?: KpiFormData | null;
  mode?: KpiFormMode;
  readOnly?: boolean;
  processes?: string[]; // Injected by the parent page — department-specific
  onSubmit: (data: KpiFormData) => void;
  onCancel: () => void;
}

export default function KpiForm({ 
  initialData, 
  mode = "create", 
  readOnly = false, 
  processes = [], 
  onSubmit, 
  onCancel 
}: KpiFormProps) {
  const [formData, setFormData] = useState<KpiFormData>(() => {
    if (initialData) return initialData;
    return {
      processName: processes[0] ?? "",
      name: "",
      target: "",
      actual: "",
      status: "Pending",
      justification: "",
      customFields: [],
    };
  })

  const handleStatusChange = (status: KpiStatus) => {
    setFormData({ ...formData, status })
  }

  const isEditMode = mode !== "create"
  const showPhase1 = mode === "create" || mode === "edit-plan" || mode === "view-all" || readOnly
  const showPhase2 = mode === "review-progress" || mode === "view-all" || readOnly
  const isDeviationRequired = formData.status === "Deviated"

  return (
    <div className="space-y-8">

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── PHASE 1: KPI DEFINITION ────────── */}
      {/* ────────────────────────────────────────────────────────── */}
      {showPhase1 && (
        <div className="space-y-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/30 p-5">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Phase 1: KPI Definition
                </h3>
                <p className="text-xs text-muted-foreground">
                  Define the core metric and the target success criteria.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] font-medium bg-white dark:bg-zinc-950">
              Definition
            </Badge>
          </div>

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
                <SelectTrigger className="w-full bg-white dark:bg-zinc-950">
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
                className="bg-white dark:bg-zinc-950"
              />
            )}
          </div>

          {/* KPI Description */}
          <div className="space-y-2">
            <Label htmlFor="kpi-name">
              KPI Description <span className="text-rose-500">*</span>
            </Label>
            {isEditMode ? (
              <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{formData.name}</div>
            ) : (
              <Input
                id="kpi-name"
                placeholder="e.g., Customer Churn Rate"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="bg-white dark:bg-zinc-950"
              />
            )}
          </div>

          {/* Target Value */}
          <div className="space-y-2">
            <Label htmlFor="kpi-target">
              Target Value <span className="text-rose-500">*</span>
            </Label>
            {readOnly ? (
              <div className="font-medium text-sm text-slate-900 dark:text-slate-100">{formData.target}</div>
            ) : (
              <Input
                id="kpi-target"
                placeholder="e.g., < 5%"
                value={formData.target}
                onChange={(e) => setFormData({ ...formData, target: e.target.value })}
                className="bg-white dark:bg-zinc-950"
              />
            )}
          </div>

          {/* ── Dynamic Department Requirements ── */}
          <div className="space-y-3 pt-4 border-t border-slate-200/80 dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <div>
                <Label>Department Requirements</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Add any custom metrics, context, or subjective fields required by your department.
                </p>
              </div>
              {!readOnly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1.5 bg-white dark:bg-zinc-950"
                  onClick={() => {
                    const newField = { id: Math.random().toString(36).substring(7), name: "", value: "" }
                    setFormData({ ...formData, customFields: [...(formData.customFields || []), newField] })
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Field
                </Button>
              )}
            </div>

            {(formData.customFields?.length || 0) > 0 ? (
              <div className="space-y-3 mt-3">
                {formData.customFields?.map((field, index) => (
                  <div key={field.id} className="flex items-start gap-2">
                    <div className="grid grid-cols-2 gap-2 flex-1">
                      <div>
                        <Input
                          placeholder="Field Name (e.g. Data Source)"
                          value={field.name}
                          readOnly={readOnly}
                          onChange={(e) => {
                            const newFields = [...(formData.customFields || [])]
                            newFields[index].name = e.target.value
                            setFormData({ ...formData, customFields: newFields })
                          }}
                          className={readOnly ? "bg-slate-100 dark:bg-zinc-900 border-dashed" : "bg-white dark:bg-zinc-950"}
                        />
                      </div>
                      <div>
                        <Input
                          placeholder="Value"
                          value={field.value}
                          readOnly={readOnly}
                          onChange={(e) => {
                            const newFields = [...(formData.customFields || [])]
                            newFields[index].value = e.target.value
                            setFormData({ ...formData, customFields: newFields })
                          }}
                          className={readOnly ? "bg-slate-100 dark:bg-zinc-900 border-dashed" : "bg-white dark:bg-zinc-950"}
                        />
                      </div>
                    </div>
                    {!readOnly && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950 shrink-0"
                        onClick={() => {
                          const newFields = formData.customFields?.filter((_, i) => i !== index)
                          setFormData({ ...formData, customFields: newFields })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              readOnly && (
                <p className="text-sm text-muted-foreground italic">No custom requirements added.</p>
              )
            )}
          </div>
        </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── PHASE 2: PERFORMANCE MEASUREMENT ────────── */}
      {/* ────────────────────────────────────────────────────────── */}
      {showPhase2 && (
        <div className="space-y-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                <Activity className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                  Phase 2: Performance Measurement
                </h3>
                <p className="text-xs text-muted-foreground">
                  Log the actual results and any required deviation justifications.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-[11px] font-medium bg-slate-50 dark:bg-zinc-900">
              Measurement
            </Badge>
          </div>

          {/* Status */}
          <div className="space-y-3">
            <Label>Current Status</Label>
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

          {/* Actual Value */}
          <div className="space-y-2">
            <Label htmlFor="kpi-actual">Actual Recorded Value</Label>
            {readOnly ? (
              <p className="text-sm font-medium">{formData.actual || "—"}</p>
            ) : (
              <Input
                id="kpi-actual"
                value={formData.actual || ""}
                placeholder="e.g., 4.2%"
                onChange={(e) => setFormData({ ...formData, actual: e.target.value })}
              />
            )}
          </div>

          {/* Justification for Deviation */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {isDeviationRequired && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                <Label htmlFor="kpi-justification">
                  Justification for Deviation
                  {isDeviationRequired && <span className="text-rose-500 ml-1">*</span>}
                </Label>
              </div>
              {isDeviationRequired && (
                <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300">
                  Required
                </Badge>
              )}
            </div>
            {readOnly ? (
              <p className="text-sm text-muted-foreground">{formData.justification || "—"}</p>
            ) : (
              <textarea
                id="kpi-justification"
                className={`flex min-h-[70px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none ${isDeviationRequired ? "border-amber-400 dark:border-amber-600/60 bg-amber-50/30 dark:bg-amber-950/10" : "border-input"}`}
                placeholder={isDeviationRequired ? "Explain why the target was missed..." : "Optional context..."}
                value={formData.justification || ""}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              />
            )}
          </div>

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
              {mode === "create" ? "Create KPI" : mode === "edit-plan" ? "Save KPI Definition" : "Log Measurement"}
            </Button>
          </>
        )}
      </div>

    </div>
  )
}
