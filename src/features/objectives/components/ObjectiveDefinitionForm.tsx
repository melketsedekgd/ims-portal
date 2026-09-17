"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Layers, Target, ListChecks, Plus, Trash2, Calculator, PencilLine } from "lucide-react"
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
import { createObjective } from "@/features/objectives/mutations"
import type { ObjectiveScoringMode } from "@/features/objectives/schema"
import { todayInAddisAbaba } from "@/features/objectives/dates"
import type { CreatableDepartment, ProcessOption } from "@/features/kpis/queries"

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

/** A local key for React; not sent — display_order is the array position. */
type ActivityRow = {
  key: number
  title: string
  description: string
  ownerTitle: string
  plannedStartDate: string
  plannedCompletionDate: string
}

let nextKey = 1
const blankActivity = (): ActivityRow => ({
  key: nextKey++,
  title: "",
  description: "",
  ownerTitle: "",
  plannedStartDate: "",
  plannedCompletionDate: "",
})

const MODES: { value: ObjectiveScoringMode; icon: React.ReactNode; title: string; hint: string }[] = [
  {
    value: "activities",
    icon: <Calculator className="h-4 w-4" />,
    title: "Scored by activities",
    hint: "Achievement is completed ÷ total activities. It is computed, never typed, and each period's measurement keeps the count as it stood.",
  },
  {
    value: "direct",
    icon: <PencilLine className="h-4 w-4" />,
    title: "Directly entered",
    hint: "No activities. A percentage is entered each period, the way SRD's objectives are reported.",
  },
]

/**
 * Create-objective form. Every option list comes from the server component
 * that renders it; nothing here reads mock data or decides permissions. If
 * the insert is refused the message from createObjective is shown as a
 * toast — the database is the authority on who may create.
 *
 * The scoring mode is an explicit choice with no default. The database
 * infers it from whether activities exist, so leaving it implicit would let
 * a form with no activity rows create a direct-entry objective that nobody
 * asked for.
 */
export default function ObjectiveDefinitionForm({
  departments,
  processes,
}: {
  departments: CreatableDepartment[]
  processes: ProcessOption[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "")
  const [processId, setProcessId] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [targetDate, setTargetDate] = useState("")
  const [mode, setMode] = useState<ObjectiveScoringMode | "">("")
  const [activities, setActivities] = useState<ActivityRow[]>([blankActivity()])

  // All creatable departments' processes were fetched up front; switching
  // department is a filter, not a refetch. The chosen process is cleared so a
  // process from the previous department cannot be submitted —
  // guard_objective_process_department() would refuse it anyway.
  const departmentProcesses = processes.filter((p) => p.departmentId === departmentId)
  const changeDepartment = (id: string) => {
    setDepartmentId(id)
    setProcessId("")
  }

  // Base UI's Select.Value renders the raw value unless Root is given
  // `items`; built from the same arrays that render the SelectItems.
  const NO_PROCESS = "__none"
  const departmentItems = departments.map((d) => ({ value: d.id, label: d.name }))
  const processItems = [
    { value: NO_PROCESS, label: "No process (department-wide)" },
    ...departmentProcesses.map((p) => ({ value: p.id, label: p.name })),
  ]

  const updateActivity = (key: number, patch: Partial<ActivityRow>) =>
    setActivities((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  const removeActivity = (key: number) =>
    setActivities((rows) => rows.filter((r) => r.key !== key))

  const handleSubmit = () => {
    if (!mode) {
      toast.error("Choose how the objective is scored.")
      return
    }
    if (mode === "activities" && activities.length === 0) {
      toast.error("An objective scored by activities needs at least one activity.")
      return
    }
    startTransition(async () => {
      // On success createObjective redirects and never resolves; a resolved
      // value is always a failure.
      const result = await createObjective({
        departmentId,
        processId: processId || null,
        title,
        description,
        targetDate,
        mode,
        // The rows are only meaningful in activities mode. Sending the kept
        // rows for a direct objective would be refused by the schema, so
        // they are dropped here rather than silently created.
        activities:
          mode === "activities"
            ? activities.map((a) => ({
                title: a.title,
                description: a.description,
                ownerTitle: a.ownerTitle,
                plannedStartDate: a.plannedStartDate,
                plannedCompletionDate: a.plannedCompletionDate,
              }))
            : [],
      })
      if (!result.ok) toast.error(result.message)
    })
  }

  return (
    <div className="space-y-6">
      <Section
        icon={<Target className="h-4 w-4" />}
        title="Definition"
        hint="What the department sets out to do."
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
          <Label>Process</Label>
          <Select value={processId} onValueChange={(v) => v && setProcessId(v === NO_PROCESS ? "" : v)} items={processItems}>
            <SelectTrigger className="w-full bg-white dark:bg-slate-950">
              <div className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-muted-foreground" />
                <SelectValue placeholder="No process (department-wide)" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {processItems.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Optional. An objective can sit under no process.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="objective-title">Title <Req /></Label>
          <textarea
            id="objective-title"
            className={textareaClass}
            placeholder="e.g., Achieve 80% completion of milestones within their planned schedule by 31 Dec 2026"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="objective-description">Description</Label>
          <textarea
            id="objective-description"
            className={textareaClass}
            placeholder="Context the title does not carry."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Owner and start date are not asked for: the owner is the
            department's manager and the start date is today, both set by
            the server. The grid keeps the target date at one column's width. */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="objective-target">Target date</Label>
            <Input
              id="objective-target"
              type="date"
              value={targetDate}
              min={todayInAddisAbaba()}
              onChange={(e) => setTargetDate(e.target.value)}
              className="bg-white dark:bg-slate-950"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Owned by the department manager, starting today.
        </p>
      </Section>

      <Section
        icon={<ListChecks className="h-4 w-4" />}
        title="Scoring"
        hint="How achievement is produced each period. This cannot be changed from the report later."
      >
        <fieldset className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <legend className="sr-only">Scoring mode</legend>
          {MODES.map((m) => {
            const selected = mode === m.value
            return (
              <label
                key={m.value}
                className={`flex gap-3 rounded-lg border p-4 cursor-pointer transition-colors ${
                  selected
                    ? "border-blue-500 bg-blue-50/60 dark:border-blue-500 dark:bg-blue-950/30"
                    : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                <input
                  type="radio"
                  name="scoring-mode"
                  value={m.value}
                  checked={selected}
                  onChange={() => setMode(m.value)}
                  className="mt-1 h-4 w-4 shrink-0 accent-blue-600"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {m.icon}
                    {m.title}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{m.hint}</p>
                </div>
              </label>
            )
          })}
        </fieldset>

        {mode === "activities" && (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label>Activities <Req /></Label>
              <span className="text-xs text-muted-foreground">
                {activities.length} {activities.length === 1 ? "activity" : "activities"} · listed in report order
              </span>
            </div>

            {activities.length === 0 && (
              <p className="text-sm text-rose-600 dark:text-rose-400">
                At least one activity is required for this scoring mode.
              </p>
            )}

            {activities.map((a, i) => (
              <div
                key={a.key}
                className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4"
              >
                <div className="flex items-start gap-3">
                  <span className="mt-2 text-sm font-medium tabular-nums text-muted-foreground w-5 shrink-0">
                    {i + 1}.
                  </span>
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`activity-${a.key}-title`} className="sr-only">Activity title</Label>
                    <Input
                      id={`activity-${a.key}-title`}
                      placeholder="Activity title"
                      value={a.title}
                      onChange={(e) => updateActivity(a.key, { title: e.target.value })}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove activity ${i + 1}`}
                    onClick={() => removeActivity(a.key)}
                    className="shrink-0 text-muted-foreground hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-8">
                  <div className="space-y-1">
                    <Label htmlFor={`activity-${a.key}-owner`} className="text-xs">Owner</Label>
                    <Input
                      id={`activity-${a.key}-owner`}
                      placeholder="e.g., Systems Administrator"
                      value={a.ownerTitle}
                      onChange={(e) => updateActivity(a.key, { ownerTitle: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`activity-${a.key}-start`} className="text-xs">Planned start</Label>
                    <Input
                      id={`activity-${a.key}-start`}
                      type="date"
                      value={a.plannedStartDate}
                      onChange={(e) => updateActivity(a.key, { plannedStartDate: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`activity-${a.key}-end`} className="text-xs">Planned completion</Label>
                    <Input
                      id={`activity-${a.key}-end`}
                      type="date"
                      value={a.plannedCompletionDate}
                      min={a.plannedStartDate || undefined}
                      onChange={(e) => updateActivity(a.key, { plannedCompletionDate: e.target.value })}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <div className="pl-8 space-y-1">
                  <Label htmlFor={`activity-${a.key}-description`} className="text-xs">Description</Label>
                  <textarea
                    id={`activity-${a.key}-description`}
                    className={`${textareaClass} min-h-[44px]`}
                    placeholder="Optional"
                    value={a.description}
                    onChange={(e) => updateActivity(a.key, { description: e.target.value })}
                  />
                </div>
              </div>
            ))}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActivities((rows) => [...rows, blankActivity()])}
              className="gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Add activity
            </Button>
          </div>
        )}
      </Section>

      <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-slate-800">
        <Button variant="outline" onClick={() => router.push("/department/objectives")} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Creating…" : "Create Objective"}
        </Button>
      </div>
    </div>
  )
}
