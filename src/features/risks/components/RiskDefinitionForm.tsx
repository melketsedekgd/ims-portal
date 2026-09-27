"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { CircleAlert, FileText, Gauge, Layers, Lock } from "lucide-react"
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
import { createRisk } from "@/features/risks/mutations"
import { riskDefinitionSchema } from "@/features/risks/schema"
import { riskBand, RISK_BAND_LABEL, type ScoredRiskBand } from "@/features/risks/scoring"
import { SCALE, SEVERITY_ROWS } from "@/features/risks/components/RiskHeatMap"
import { PILL, RISK_BAND_PILL, RISK_MAP_CELL } from "@/components/shared/status-styles"
import type { CreatableDepartment, ProcessOption } from "@/features/kpis/queries"

const textareaClass =
  "flex min-h-[60px] w-full rounded-md border border-input bg-white dark:bg-slate-950 px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 resize-none aria-invalid:border-destructive"

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
    <div className="min-w-0 space-y-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 p-5">
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
const Optional = () => <span className="font-normal text-muted-foreground">(optional)</span>

type Field =
  | "departmentId"
  | "processId"
  | "affectedAssets"
  | "threat"
  | "vulnerability"
  | "riskStatement"
  | "riskOwnerTitle"
  | "severity"
  | "likelihood"
type FieldErrors = Partial<Record<Field, string>>

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-xs font-medium text-rose-600 dark:text-rose-400">
      {message}
    </p>
  )
}

/** A row of 1–5 toggle buttons. Nothing is pressed until the user picks. */
function RatingButtons({
  id,
  label,
  value,
  onChange,
  error,
}: {
  id: string
  label: string
  value: number | null
  onChange: (n: number) => void
  error?: string
}) {
  return (
    <div className="space-y-2">
      <Label id={id}>{label} <Req /></Label>
      <div
        role="group"
        aria-labelledby={id}
        aria-describedby={error ? `${id}-error` : undefined}
        className="flex gap-2"
      >
        {SCALE.map((n) => {
          const pressed = value === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange(n)}
              className={`h-11 w-11 rounded-lg border text-[15px] tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                pressed
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : `bg-white dark:bg-slate-950 font-medium hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      error ? "border-destructive" : "border-input"
                    }`
              }`}
            >
              {n}
            </button>
          )
        })}
      </div>
      <FieldError id={`${id}-error`} message={error} />
    </div>
  )
}

/**
 * The chosen square on a 5 × 5 grid. Same orientation and band colours as
 * the register's RiskHeatMap: severity up the side (5 on top), likelihood
 * along the bottom. Every square takes its band's empty tint; the chosen
 * one takes the filled colour and the heat map's selected border.
 * Decorative — the RPN and band beside it say the same in text.
 */
function MiniRiskGrid({ severity, likelihood }: { severity: number | null; likelihood: number | null }) {
  return (
    <div className="flex gap-2" aria-hidden>
      <div className="flex items-center">
        <span className="text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-400 [writing-mode:vertical-rl] rotate-180">
          SEVERITY →
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-1">
        {SEVERITY_ROWS.map((s) => (
          <div key={s} className="grid grid-cols-5 gap-1">
            {SCALE.map((l) => {
              const colours = RISK_MAP_CELL[riskBand(s * l) as ScoredRiskBand]
              const chosen = s === severity && l === likelihood
              return (
                <div
                  key={l}
                  className={[
                    "flex h-8 items-center justify-center rounded-md text-xs tabular-nums",
                    chosen
                      ? `${colours.filled} border-[3px] border-[#0f172a] font-bold`
                      : `${colours.empty} border border-slate-900/10 text-slate-600`,
                  ].join(" ")}
                >
                  {s * l}
                </div>
              )
            })}
          </div>
        ))}
        <span className="pt-0.5 text-center text-xs font-semibold tracking-wide text-slate-600 dark:text-slate-400">
          LIKELIHOOD →
        </span>
      </div>
    </div>
  )
}

/**
 * Create-risk form. Every option list comes from the server component that
 * renders it; nothing here decides permissions. The fields are checked
 * against riskDefinitionSchema before sending so each error sits under its
 * field; a refusal from createRisk is shown in the banner — the database is
 * the authority on who may create.
 *
 * Severity and likelihood start unpicked. They become the risk's baseline,
 * and a default would save a starting score nobody chose.
 */
export default function RiskDefinitionForm({
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
  const [affectedAssets, setAffectedAssets] = useState("")
  const [threat, setThreat] = useState("")
  const [vulnerability, setVulnerability] = useState("")
  const [riskStatement, setRiskStatement] = useState("")
  const [riskOwnerTitle, setRiskOwnerTitle] = useState("")
  const [severity, setSeverity] = useState<number | null>(null)
  const [likelihood, setLikelihood] = useState<number | null>(null)

  const [errors, setErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<string | null>(null)

  /** Wraps a setter so editing a field clears its error. */
  const edit =
    <T,>(field: Field, set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
    }

  // All creatable departments' processes were fetched up front; switching
  // department is a filter, not a refetch. The chosen process is cleared so
  // a process from the previous department cannot be submitted —
  // create_risk_with_baseline() would refuse it anyway.
  const department = departments.find((d) => d.id === departmentId)
  const departmentProcesses = processes.filter((p) => p.departmentId === departmentId)
  const changeDepartment = edit("departmentId", (id: string) => {
    setDepartmentId(id)
    setProcessId("")
  })

  // Base UI's Select.Value renders the raw value unless Root is given
  // `items`; built from the same arrays that render the SelectItems.
  const NO_PROCESS = "__none"
  const departmentItems = departments.map((d) => ({ value: d.id, label: d.name }))
  const processItems = [
    { value: NO_PROCESS, label: "No process" },
    ...departmentProcesses.map((p) => ({ value: p.id, label: p.name })),
  ]

  const rpn = severity !== null && likelihood !== null ? severity * likelihood : null
  const band = riskBand(rpn)

  const handleSubmit = () => {
    const input = {
      departmentId,
      processId: processId || null,
      affectedAssets,
      threat,
      vulnerability,
      riskStatement,
      riskOwnerTitle,
      severity: severity ?? undefined,
      likelihood: likelihood ?? undefined,
    }

    const parsed = riskDefinitionSchema.safeParse(input)
    if (!parsed.success) {
      const next: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as Field
        next[field] ??= issue.message
      }
      // Unpicked is not "out of range": say what to do.
      if (severity === null) next.severity = "Choose a severity"
      if (likelihood === null) next.likelihood = "Choose a likelihood"
      setErrors(next)
      setBanner(
        Object.keys(next).length === 1
          ? "The risk wasn't created. Fix the field marked below and try again."
          : "The risk wasn't created. Fix the fields marked below and try again."
      )
      return
    }

    setErrors({})
    setBanner(null)
    startTransition(async () => {
      // On success createRisk redirects and never resolves; a resolved
      // value is always a failure.
      const result = await createRisk(parsed.data)
      if (!result.ok) setBanner(result.message)
    })
  }

  const describedBy = (field: Field, hintId?: string) =>
    [errors[field] ? `risk-${field}-error` : null, hintId].filter(Boolean).join(" ") || undefined

  return (
    <div className="space-y-6">
      {banner && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300"
        >
          <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{banner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Section
          icon={<FileText className="h-4 w-4" />}
          title="Details"
          hint="What is at risk, and from what."
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              {departments.length > 1 ? (
                <>
                  <Label>Department <Req /></Label>
                  <Select
                    value={departmentId}
                    onValueChange={(v) => v && changeDepartment(v)}
                    items={departmentItems}
                  >
                    <SelectTrigger
                      className="w-full bg-white dark:bg-slate-950"
                      aria-invalid={errors.departmentId ? true : undefined}
                      aria-describedby={describedBy("departmentId")}
                    >
                      <SelectValue placeholder="Select a department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departmentItems.map((d) => (
                        <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError id="risk-departmentId-error" message={errors.departmentId} />
                </>
              ) : (
                <>
                  <Label>Department</Label>
                  <div className="flex h-8 items-center gap-2 rounded-lg border border-input bg-slate-100 px-2.5 text-sm text-slate-700 dark:bg-slate-900 dark:text-slate-300"
                  >
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span>{department?.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Set to the department you manage.</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>Process <Optional /></Label>
              <Select
                value={processId}
                onValueChange={(v) => v && edit("processId", setProcessId)(v === NO_PROCESS ? "" : v)}
                items={processItems}
              >
                <SelectTrigger
                  className="w-full bg-white dark:bg-slate-950"
                  aria-invalid={errors.processId ? true : undefined}
                  aria-describedby={describedBy("processId", "risk-process-hint")}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <SelectValue placeholder="No process" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {processItems.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError id="risk-processId-error" message={errors.processId} />
              <p id="risk-process-hint" className="text-xs text-muted-foreground">
                {departments.length > 1
                  ? "Clears when the department changes."
                  : `Only ${department?.name ?? "your department"}'s processes are listed.`}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="risk-assets">Affected assets <Req /></Label>
            <Input
              id="risk-assets"
              placeholder="e.g., Source code repository"
              value={affectedAssets}
              onChange={(e) => edit("affectedAssets", setAffectedAssets)(e.target.value)}
              aria-invalid={errors.affectedAssets ? true : undefined}
              aria-describedby={describedBy("affectedAssets")}
              className="bg-white dark:bg-slate-950"
            />
            <FieldError id="risk-affectedAssets-error" message={errors.affectedAssets} />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="risk-threat">Threat <Optional /></Label>
              <Input
                id="risk-threat"
                placeholder="What could happen"
                value={threat}
                onChange={(e) => edit("threat", setThreat)(e.target.value)}
                aria-invalid={errors.threat ? true : undefined}
                aria-describedby={describedBy("threat")}
                className="bg-white dark:bg-slate-950"
              />
              <FieldError id="risk-threat-error" message={errors.threat} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="risk-vulnerability">Vulnerability <Optional /></Label>
              <Input
                id="risk-vulnerability"
                placeholder="The weakness it exploits"
                value={vulnerability}
                onChange={(e) => edit("vulnerability", setVulnerability)(e.target.value)}
                aria-invalid={errors.vulnerability ? true : undefined}
                aria-describedby={describedBy("vulnerability")}
                className="bg-white dark:bg-slate-950"
              />
              <FieldError id="risk-vulnerability-error" message={errors.vulnerability} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="risk-statement">Risk statement <Optional /></Label>
            <textarea
              id="risk-statement"
              rows={3}
              className={textareaClass}
              placeholder="One line describing the risk"
              value={riskStatement}
              onChange={(e) => edit("riskStatement", setRiskStatement)(e.target.value)}
              aria-invalid={errors.riskStatement ? true : undefined}
              aria-describedby={describedBy("riskStatement", "risk-statement-hint")}
            />
            <FieldError id="risk-riskStatement-error" message={errors.riskStatement} />
            <p id="risk-statement-hint" className="text-xs text-muted-foreground">
              If left empty, the register shows the threat or the asset as the risk&apos;s name
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="risk-owner">Risk owner <Optional /></Label>
            <Input
              id="risk-owner"
              placeholder="Job title"
              value={riskOwnerTitle}
              onChange={(e) => edit("riskOwnerTitle", setRiskOwnerTitle)(e.target.value)}
              aria-invalid={errors.riskOwnerTitle ? true : undefined}
              aria-describedby={describedBy("riskOwnerTitle", "risk-owner-hint")}
              className="bg-white dark:bg-slate-950"
            />
            <FieldError id="risk-riskOwnerTitle-error" message={errors.riskOwnerTitle} />
            <p id="risk-owner-hint" className="text-xs text-muted-foreground">
              A job title, as on the quarterly report
            </p>
          </div>
        </Section>

        <Section
          icon={<Gauge className="h-4 w-4" />}
          title="Starting rating"
          hint="Saved as the baseline, before any treatment."
        >
          <RatingButtons
            id="risk-severity"
            label="Severity"
            value={severity}
            onChange={edit("severity", setSeverity)}
            error={errors.severity}
          />
          <RatingButtons
            id="risk-likelihood"
            label="Likelihood"
            value={likelihood}
            onChange={edit("likelihood", setLikelihood)}
            error={errors.likelihood}
          />

          <div
            aria-live="polite"
            className="flex items-center gap-4 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
          >
            <div className="flex min-w-16 flex-col items-center">
              <span className="text-4xl font-bold leading-none tabular-nums">{rpn ?? "—"}</span>
              <span className="mt-1 text-xs text-muted-foreground">RPN</span>
            </div>
            <div className="flex flex-col items-start gap-1.5">
              {rpn !== null ? (
                <>
                  <span className={`${PILL} ${RISK_BAND_PILL[band]}`}>{RISK_BAND_LABEL[band]}</span>
                  <span className="text-sm text-muted-foreground">
                    Severity {severity} × Likelihood {likelihood}
                  </span>
                </>
              ) : (
                <span className="text-sm text-muted-foreground">
                  Pick a severity and a likelihood to see the band.
                </span>
              )}
            </div>
          </div>

          <MiniRiskGrid severity={severity} likelihood={likelihood} />

          <p className="text-xs text-muted-foreground">
            Same bands as the risk map: Low 1–4, Medium 5–14, Critical 15–25.
          </p>
        </Section>
      </div>

      <div className="flex items-center justify-end gap-3 pt-4 border-t dark:border-slate-800">
        <Button variant="outline" onClick={() => router.push("/department/risks")} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={pending}>
          {pending ? "Creating…" : "Create risk"}
        </Button>
      </div>
    </div>
  )
}
