"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Layers, Target, Activity, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Constants, type Enums } from "@/types/database"
import { createKpi } from "@/features/kpis/mutations"
import { formatTargetText } from "@/features/kpis/calculations"
import type {
  CreatableDepartment,
  ProcessOption,
  UnitOption,
} from "@/features/kpis/queries"

const FREQUENCY: Record<Enums<"period_type">, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
}

const DIRECTION: Record<Enums<"target_direction">, string> = {
  higher_is_better: "Higher is better",
  lower_is_better: "Lower is better",
  exact: "Exact match",
}

const AGGREGATION: Record<Enums<"aggregation_method">, string> = {
  average: "Average",
  sum: "Sum",
  min: "Minimum",
  max: "Maximum",
  latest: "Latest",
}

const textareaClass =
  "flex min-h-[60px] w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none"

function Section({
  icon,
  title,
  hint,
  children,
}: {
  icon: React.ReactNode
  title: string
  hint: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-5">
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
        <div className="p-1.5 rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h3>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </div>
      </div>
      {children}
    </div>
  )
}

const Req = () => <span className="text-rose-500">*</span>

/**
 * Create-KPI form. Every option list comes from the server component that
 * renders it; nothing here reads mock data or decides permissions. If the
 * insert is refused the message from createKpi is shown as a toast — the
 * database is the authority on who may create.
 */
export default function KpiDefinitionForm({
  departments,
  processes,
  units,
}: {
  departments: CreatableDepartment[]
  processes: ProcessOption[]
  units: UnitOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "")
  const [processId, setProcessId] = useState("")
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [targetUnit, setTargetUnit] = useState("")
  const [targetDirection, setTargetDirection] = useState<Enums<"target_direction"> | "">("")
  const [measurementFrequency, setMeasurementFrequency] = useState<Enums<"period_type"> | "">("")
  const [aggregationMethod, setAggregationMethod] = useState<Enums<"aggregation_method">>("average")
  const [dataSource, setDataSource] = useState("")
  const [analysisMethodology, setAnalysisMethodology] = useState("")
  const [responsibilityTitle, setResponsibilityTitle] = useState("")

  // All creatable departments' processes were fetched up front; switching
  // department is a filter, not a refetch. The chosen process is cleared so a
  // process from the previous department cannot be submitted.
  const departmentProcesses = processes.filter((p) => p.departmentId === departmentId)
  const changeDepartment = (id: string) => {
    setDepartmentId(id)
    setProcessId("")
  }

  // Base UI's Select.Value renders the raw value unless Root is given
  // `items`; each list below is built from the same array that renders its
  // SelectItems, so the trigger and the popup cannot drift.
  const departmentItems = departments.map((d) => ({ value: d.id, label: d.name }))
  const processItems = departmentProcesses.map((p) => ({ value: p.id, label: p.name }))
  const unitItems = units.map((u) => ({ value: u.key, label: u.label }))
  const directionItems = Constants.public.Enums.target_direction.map((d) => ({ value: d, label: DIRECTION[d] }))
  const frequencyItems = Constants.public.Enums.period_type.map((f) => ({ value: f, label: FREQUENCY[f] }))
  const aggregationItems = Constants.public.Enums.aggregation_method.map((a) => ({ value: a, label: AGGREGATION[a] }))

  // What the server will store as target_text, shown live once all three
  // parts are filled. The mutation composes the real one; this is a preview.
  const targetNumber = targetValue.trim() === "" ? NaN : Number(targetValue)
  const unitLabel = units.find((u) => u.key === targetUnit)?.label
  const targetPreview =
    targetDirection && targetUnit && unitLabel && Number.isFinite(targetNumber)
      ? formatTargetText(targetDirection, targetNumber, targetUnit, unitLabel)
      : null

  const handleSubmit = () => {
    if (!targetDirection || !measurementFrequency) {
      toast.error("Choose a target direction and a measurement frequency.")
      return
    }
    startTransition(async () => {
      // On success createKpi redirects and never resolves; a resolved value
      // is always a failure.
      const result = await createKpi({
        departmentId,
        processId,
        name,
        description,
        targetValue,
        targetUnit,
        targetDirection,
        measurementFrequency,
        aggregationMethod,
        dataSource,
        analysisMethodology,
        responsibilityTitle,
      })
      if (!result.ok) toast.error(result.message)
    })
  }

  return (
    <div className="space-y-6">
      <Section
        icon={<Target className="h-4 w-4" />}
        title="Definition"
        hint="What is measured, and which process owns it."
      >
        {departments.length > 1 && (
          <div className="space-y-2">
            <Label>Department <Req /></Label>
            <Select value={departmentId} onValueChange={(v) => v && changeDepartment(v)} items={departmentItems}>
              <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {departmentItems.map((d) => (
                  <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label>Process <Req /></Label>
          <Select value={processId} onValueChange={(v) => v && setProcessId(v)} items={processItems}>
            <SelectTrigger className="w-full bg-white dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="Select a process" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {processItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="kpi-name">Name <Req /></Label>
          <Input
            id="kpi-name"
            placeholder="e.g., Mean time to restore"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-white dark:bg-slate-950"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kpi-description">Description</Label>
          <textarea
            id="kpi-description"
            className={textareaClass}
            placeholder="What this KPI tells the department, and why it is tracked."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </Section>

      <Section
        icon={<Activity className="h-4 w-4" />}
        title="Target"
        hint="What the KPI is scored against."
      >
        <div className="space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Direction <Req /></Label>
              <Select value={targetDirection} onValueChange={(v) => v && setTargetDirection(v as Enums<"target_direction">)} items={directionItems}>
                <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {directionItems.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="kpi-target-value">Target value <Req /></Label>
              <Input
                id="kpi-target-value"
                type="number"
                step="any"
                placeholder="e.g., 95"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className="bg-white dark:bg-slate-950"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit <Req /></Label>
              <Select value={targetUnit} onValueChange={(v) => v && setTargetUnit(v)} items={unitItems}>
                <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                  <SelectValue placeholder="Select a unit" />
                </SelectTrigger>
                <SelectContent>
                  {unitItems.map((u) => (
                    <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {targetPreview && (
            <p className="text-xs text-muted-foreground">
              Shows on reports as <span className="font-medium text-foreground">{targetPreview}</span>
            </p>
          )}
        </div>
      </Section>

      <Section
        icon={<FileText className="h-4 w-4" />}
        title="Measurement"
        hint="How often it is measured, and how the values combine."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Measurement frequency <Req /></Label>
            <Select value={measurementFrequency} onValueChange={(v) => v && setMeasurementFrequency(v as Enums<"period_type">)} items={frequencyItems}>
              <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {frequencyItems.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Aggregation</Label>
            <Select value={aggregationMethod} onValueChange={(v) => v && setAggregationMethod(v as Enums<"aggregation_method">)} items={aggregationItems}>
              <SelectTrigger className="w-full bg-white dark:bg-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aggregationItems.map((a) => (
                  <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="kpi-source">Data source</Label>
          <Input
            id="kpi-source"
            placeholder="e.g., Story points from Scrum Board"
            value={dataSource}
            onChange={(e) => setDataSource(e.target.value)}
            className="bg-white dark:bg-slate-950"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kpi-methodology">Analysis methodology</Label>
          <textarea
            id="kpi-methodology"
            className={textareaClass}
            placeholder="e.g., Sum(Tasks Completed) / Number of Tasks"
            value={analysisMethodology}
            onChange={(e) => setAnalysisMethodology(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="kpi-responsibility">Responsibility</Label>
          <Input
            id="kpi-responsibility"
            placeholder="e.g., Scrum Master"
            value={responsibilityTitle}
            onChange={(e) => setResponsibilityTitle(e.target.value)}
            className="bg-white dark:bg-slate-950"
          />
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-slate-800">
        <Button variant="outline" onClick={() => router.push("/department/kpis")} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Creating…" : "Create KPI"}
        </Button>
      </div>
    </div>
  )
}
