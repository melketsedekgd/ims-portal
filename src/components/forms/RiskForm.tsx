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

// ── Types ──

export type RiskStatus = "Open" | "Mitigating" | "Closed"

export interface RiskFormData {
  id?: string
  processName: string
  title: string
  description: string
  likelihood: number            // 1–5
  severity: number              // 1–5
  riskScore: number             // auto: likelihood × severity
  mitigationStrategy: string
  status: RiskStatus
  linkedObjective: string       // Objective name from the same process
}

export interface AvailableObjective {
  name: string
  processName: string
}

interface RiskFormProps {
  initialData?: RiskFormData | null
  isEditMode?: boolean
  readOnly?: boolean
  processes?: string[]
  availableObjectives?: AvailableObjective[]
  onSubmit: (data: RiskFormData) => void
  onCancel: () => void
}

// ── Score Helpers ──

function getScoreColor(score: number) {
  if (score >= 15) return { bg: "bg-rose-100 dark:bg-rose-900/40", text: "text-rose-800 dark:text-rose-400", label: "Critical" }
  if (score >= 5)  return { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-800 dark:text-amber-400", label: "Medium" }
  return { bg: "bg-emerald-100 dark:bg-emerald-900/40", text: "text-emerald-800 dark:text-emerald-400", label: "Low" }
}

function ScoreBadgePreview({ score }: { score: number }) {
  const color = getScoreColor(score)
  return (
    <Badge className={`${color.bg} ${color.text} hover:${color.bg} font-semibold tabular-nums`}>
      {score} · {color.label}
    </Badge>
  )
}

export default function RiskForm({
  initialData,
  isEditMode = false,
  readOnly = false,
  processes = [],
  availableObjectives = [],
  onSubmit,
  onCancel,
}: RiskFormProps) {
  const [formData, setFormData] = useState<RiskFormData>(() => {
    if (initialData) return initialData
    return {
      processName: processes[0] ?? "",
      title: "",
      description: "",
      likelihood: 1,
      severity: 1,
      riskScore: 1, // 1 * 1
      mitigationStrategy: "",
      status: "Open",
      linkedObjective: "",
    }
  })

  const handleStatusChange = (status: RiskStatus) => {
    setFormData({ ...formData, status })
  }

  // Filter available objectives to the selected process
  const filteredObjectives = availableObjectives.filter(
    obj => obj.processName === formData.processName
  )

  // Auto-calculate risk score helper
  const updateScore = (updates: Partial<RiskFormData>) => {
    const nextData = { ...formData, ...updates }
    nextData.riskScore = nextData.likelihood * nextData.severity
    setFormData(nextData)
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
            onValueChange={(val) => setFormData({ ...formData, processName: val ?? "", linkedObjective: "" })}
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

      {/* Risk Title */}
      <div className="space-y-2">
        <Label htmlFor="risk-title">
          Risk Title <span className="text-rose-500">*</span>
        </Label>
        {isEditMode ? (
          <div className="font-medium">{formData.title}</div>
        ) : (
          <Input
            id="risk-title"
            placeholder="e.g., Core Router Failure"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
        )}
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="risk-desc">Description</Label>
        {readOnly ? (
          <p className="text-sm text-muted-foreground">{formData.description || "—"}</p>
        ) : (
          <textarea
            id="risk-desc"
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            placeholder="Describe the nature of the risk..."
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
        )}
      </div>

      {/* Assessment Matrix */}
      <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-zinc-900/50 p-4 rounded-lg border border-slate-100 dark:border-zinc-800">
        <div className="space-y-2">
          <Label>Likelihood (1-5)</Label>
          {readOnly ? (
            <div className="text-sm font-semibold">{formData.likelihood}</div>
          ) : (
            <Select
              value={formData.likelihood.toString()}
              onValueChange={(val) => updateScore({ likelihood: Number(val) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2">
          <Label>Severity (1-5)</Label>
          {readOnly ? (
            <div className="text-sm font-semibold">{formData.severity}</div>
          ) : (
            <Select
              value={formData.severity.toString()}
              onValueChange={(val) => updateScore({ severity: Number(val) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="space-y-2 flex flex-col justify-between">
          <Label>Calculated Score</Label>
          <div className="h-9 flex items-center">
            <ScoreBadgePreview score={formData.riskScore} />
          </div>
        </div>
      </div>

      {/* Mitigation Strategy */}
      <div className="space-y-2">
        <Label htmlFor="risk-mitigation">Mitigation Strategy</Label>
        {readOnly ? (
          <p className="text-sm text-muted-foreground">{formData.mitigationStrategy || "—"}</p>
        ) : (
          <textarea
            id="risk-mitigation"
            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            placeholder="How will this risk be controlled?"
            value={formData.mitigationStrategy}
            onChange={(e) => setFormData({ ...formData, mitigationStrategy: e.target.value })}
          />
        )}
      </div>

      {/* Linked Objective */}
      <div className="space-y-2">
        <Label>Linked Objective</Label>
        {readOnly ? (
          <p className="text-sm text-muted-foreground">{formData.linkedObjective || "—"}</p>
        ) : (
          <Select
            value={formData.linkedObjective}
            onValueChange={(val) => setFormData({ ...formData, linkedObjective: val === "none" ? "" : (val || "") })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select the threatened objective" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none" className="text-muted-foreground italic">None</SelectItem>
              {filteredObjectives.map((obj) => (
                <SelectItem key={obj.name} value={obj.name}>{obj.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {!readOnly && filteredObjectives.length === 0 && formData.processName && (
          <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
            No objectives found for {formData.processName}.
          </p>
        )}
      </div>

      {/* Status */}
      <div className="space-y-3">
        <Label>{isEditMode ? "Status" : "Initial Status"}</Label>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={formData.status === "Open" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "Open" ? "bg-rose-100 text-rose-800 hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("Open")}
          >
            Open
          </Badge>
          <Badge
            variant={formData.status === "Mitigating" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "Mitigating" ? "bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("Mitigating")}
          >
            Mitigating
          </Badge>
          <Badge
            variant={formData.status === "Closed" ? "default" : "outline"}
            className={`px-3 py-1 transition-colors ${readOnly ? "cursor-default" : "cursor-pointer"} ${formData.status === "Closed" ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-900/70 shadow-none border-transparent" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"}`}
            onClick={() => !readOnly && handleStatusChange("Closed")}
          >
            Closed
          </Badge>
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
              {isEditMode ? "Save Changes" : "Log Risk"}
            </Button>
          </>
        )}
      </div>

    </div>
  )
}
