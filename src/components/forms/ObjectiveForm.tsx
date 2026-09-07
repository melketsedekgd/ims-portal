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
import { 
  Layers, 
  Plus, 
  Trash2, 
  Target, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Link as LinkIcon, 
  ShieldAlert 
} from "lucide-react"

// ── Re-export types so the page can import from one place ──

export type ObjectiveStatus = "On Track" | "At Risk" | "Off Track" | "Achieved"

export interface ObjectiveFormData {
  id?: string
  processName: string
  name: string
  description: string
  successCriteria?: string       // Phase 1: Measurable completion criteria / deliverables
  targetDate: string            // Phase 1: Quarter & Year (e.g., "Q3 2026")
  linkedKpis: string[]          // Phase 1: Associated KPIs
  customFields?: { id: string; name: string; value: string }[] // Phase 1: Department subjective fields

  // Phase 2: Progress Review
  status: ObjectiveStatus       // Status (On Track, At Risk, Off Track, Achieved)
  actualPerformance?: string    // Actual completion % or performance summary (e.g. "100%", "92% completed")
  evidenceOfAchievement?: string// Links, URLs, report references (e.g. GitHub PR, audit log link)
  reasonForDeviation?: string   // Root cause / justification if off track or delayed
  followUpActions?: string      // Corrective actions / next sprint remediation
}

// ── Available KPI shape (injected by the parent page) ──

export interface AvailableKpi {
  name: string
  processName: string
}

export type ObjectiveFormMode = "create" | "edit-plan" | "review-progress" | "view-all"

interface ObjectiveFormProps {
  initialData?: ObjectiveFormData | null
  mode?: ObjectiveFormMode
  readOnly?: boolean
  processes?: string[]
  availableKpis?: AvailableKpi[]
  onSubmit: (data: ObjectiveFormData) => void
  onCancel: () => void
}

export default function ObjectiveForm({
  initialData,
  mode = "create",
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
      successCriteria: "",
      targetDate: "Q1 2026",
      status: "On Track",
      actualPerformance: "",
      evidenceOfAchievement: "",
      reasonForDeviation: "",
      followUpActions: "",
      linkedKpis: [],
      customFields: [],
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

  const isDeviationRequired = formData.status === "At Risk" || formData.status === "Off Track"

  const isEditMode = mode !== "create"
  const showPhase1 = mode === "create" || mode === "edit-plan" || mode === "view-all" || readOnly
  const showPhase2 = mode === "review-progress" || mode === "view-all" || readOnly

  return (
    <div className="space-y-8">

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── PHASE 1: OBJECTIVE SETTING (Planning Stage) ────────── */}
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
                Phase 1: Objective Setting
              </h3>
              <p className="text-xs text-muted-foreground">
                Define the strategic goal, success criteria, and period.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] font-medium bg-white dark:bg-zinc-950">
            Planning Cycle
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
              onValueChange={(val) => setFormData({ ...formData, processName: val ?? "", linkedKpis: [] })}
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

        {/* Objective Name */}
        <div className="space-y-2">
          <Label htmlFor="obj-name">
            Objective Name / Goal <span className="text-rose-500">*</span>
          </Label>
          {isEditMode ? (
            <div className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{formData.name}</div>
          ) : (
            <Input
              id="obj-name"
              placeholder="e.g., Modernize Core Infrastructure & Minimize Downtime"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="bg-white dark:bg-zinc-950"
            />
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label htmlFor="obj-desc">Scope & Objective Description</Label>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">{formData.description || "—"}</p>
          ) : (
            <textarea
              id="obj-desc"
              className="flex min-h-[70px] w-full rounded-md border border-input bg-white dark:bg-zinc-950 px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Describe what your department aims to accomplish during this cycle..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          )}
        </div>

        {/* Success Criteria / Definition of Success */}
        <div className="space-y-2">
          <Label htmlFor="obj-criteria">
            Success Criteria & Deliverables (Definition of Done)
          </Label>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">{formData.successCriteria || "—"}</p>
          ) : (
            <textarea
              id="obj-criteria"
              className="flex min-h-[70px] w-full rounded-md border border-input bg-white dark:bg-zinc-950 px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Specify the key deliverables or conditions required to consider this objective successful..."
              value={formData.successCriteria || ""}
              onChange={(e) => setFormData({ ...formData, successCriteria: e.target.value })}
            />
          )}
        </div>

        {/* Target Date (Quarter & Year) */}
        <div className="space-y-2">
          <Label>
            Target Period <span className="text-rose-500">*</span>
          </Label>
          {isEditMode || readOnly ? (
            <div className="text-sm font-medium">{formData.targetDate || "—"}</div>
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={formData.targetDate.split(" ")[0] || "Q1"}
                onValueChange={(val) => {
                  const year = formData.targetDate.split(" ")[1] || "2026"
                  setFormData({ ...formData, targetDate: `${val} ${year}` })
                }}
              >
                <SelectTrigger className="w-[110px] bg-white dark:bg-zinc-950">
                  <SelectValue placeholder="Quarter" />
                </SelectTrigger>
                <SelectContent>
                  {["Q1","Q2","Q3","Q4"].map((q) => (
                    <SelectItem key={q} value={q}>{q}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={formData.targetDate.split(" ")[1] || "2026"}
                onValueChange={(val) => {
                  const quarter = formData.targetDate.split(" ")[0] || "Q1"
                  setFormData({ ...formData, targetDate: `${quarter} ${val}` })
                }}
              >
                <SelectTrigger className="w-[110px] bg-white dark:bg-zinc-950">
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

        {/* Linked Quantitative KPIs */}
        <div className="space-y-3">
          <Label>Linked KPIs (Quantitative Targets)</Label>
          <p className="text-xs text-muted-foreground -mt-1">
            {readOnly
              ? "KPIs measuring the progress of this objective."
              : "Select the KPIs that quantitatively measure this objective."
            }
          </p>
          <div className="flex flex-wrap gap-2">
            {filteredKpis.length > 0 ? filteredKpis.map((kpi) => {
              const isSelected = formData.linkedKpis.includes(kpi.name)
              return (
                <Badge
                  key={kpi.name}
                  variant={isSelected ? "default" : "outline"}
                  className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${isSelected ? "bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 bg-white dark:bg-zinc-950"}`}
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

        {/* Dynamic Department Requirements */}
        <div className="space-y-3 pt-3 border-t border-slate-200/80 dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <Label>Department Custom Requirements</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Optional custom attributes, stakeholders, or metadata.
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
                        placeholder="Field Name (e.g. Stakeholder)"
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
      {/* ── PHASE 2: PROGRESS & PERFORMANCE REVIEW (Audit Stage) ─ */}
      {/* ────────────────────────────────────────────────────────── */}
      {showPhase2 && (
        <div className="space-y-5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Phase 2: Progress & Performance Review
              </h3>
              <p className="text-xs text-muted-foreground">
                Log actual achievement, audit evidence, and corrective action workflows.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[11px] font-medium bg-slate-50 dark:bg-zinc-900">
            Review & Audit
          </Badge>
        </div>

        {/* Objective Status */}
        <div className="space-y-3">
          <Label>Objective Status</Label>
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

        {/* Actual Performance vs. Target */}
        <div className="space-y-2">
          <Label htmlFor="obj-actual">Actual Performance / Completion Summary</Label>
          {readOnly ? (
            <p className="text-sm font-medium">{formData.actualPerformance || "—"}</p>
          ) : (
            <Input
              id="obj-actual"
              placeholder="e.g., 100% completed, or 98.7% uptime recorded"
              value={formData.actualPerformance || ""}
              onChange={(e) => setFormData({ ...formData, actualPerformance: e.target.value })}
            />
          )}
        </div>

        {/* Evidence of Achievement */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <LinkIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="obj-evidence">Evidence of Achievement (Audit Proof / URLs)</Label>
          </div>
          {readOnly ? (
            formData.evidenceOfAchievement ? (
              <a
                href={formData.evidenceOfAchievement.startsWith("http") ? formData.evidenceOfAchievement : `https://${formData.evidenceOfAchievement}`}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1.5"
              >
                <FileText className="h-4 w-4" />
                {formData.evidenceOfAchievement}
              </a>
            ) : (
              <p className="text-sm text-muted-foreground">—</p>
            )
          ) : (
            <Input
              id="obj-evidence"
              placeholder="e.g., https://github.internal.ims/progress or internal audit file path"
              value={formData.evidenceOfAchievement || ""}
              onChange={(e) => setFormData({ ...formData, evidenceOfAchievement: e.target.value })}
            />
          )}
        </div>

        {/* Reasons for Deviation (Highlighted if At Risk or Off Track) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {isDeviationRequired && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              <Label htmlFor="obj-deviation">
                Reasons for Deviation / Obstacles
                {isDeviationRequired && <span className="text-rose-500 ml-1">*</span>}
              </Label>
            </div>
            {isDeviationRequired && (
              <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300">
                Justification Required
              </Badge>
            )}
          </div>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">{formData.reasonForDeviation || "—"}</p>
          ) : (
            <textarea
              id="obj-deviation"
              className={`flex min-h-[70px] w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none ${isDeviationRequired ? "border-amber-400 dark:border-amber-600/60 bg-amber-50/30 dark:bg-amber-950/10" : "border-input"}`}
              placeholder={isDeviationRequired ? "Explain what caused the delay, obstacle, or missed target..." : "Document any factors impacting target delivery (optional)..."}
              value={formData.reasonForDeviation || ""}
              onChange={(e) => setFormData({ ...formData, reasonForDeviation: e.target.value })}
            />
          )}
        </div>

        {/* Follow-up & Corrective Actions */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="obj-actions">Follow-up Actions & Remediation Plan</Label>
          </div>
          {readOnly ? (
            <p className="text-sm text-muted-foreground">{formData.followUpActions || "—"}</p>
          ) : (
            <textarea
              id="obj-actions"
              className="flex min-h-[70px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              placeholder="Outline concrete next steps, corrective sprints, or workflows to close performance gaps..."
              value={formData.followUpActions || ""}
              onChange={(e) => setFormData({ ...formData, followUpActions: e.target.value })}
            />
          )}
        </div>
      </div>
      )}

      {/* ────────────────────────────────────────────────────────── */}
      {/* ── FOOTER ACTIONS ─────────────────────────────────────── */}
      {/* ────────────────────────────────────────────────────────── */}
      <div className="mt-8 flex items-center justify-end gap-3 pt-4 border-t dark:border-zinc-800">
        {readOnly ? (
          <Button variant="outline" onClick={onCancel} className="w-full">Close Record</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button onClick={() => onSubmit(formData)} className="bg-blue-600 hover:bg-blue-700 text-white">
              {mode === "create" ? "Create Objective" : mode === "edit-plan" ? "Save Objective Plan" : "Log Progress Review"}
            </Button>
          </>
        )}
      </div>

    </div>
  )
}

