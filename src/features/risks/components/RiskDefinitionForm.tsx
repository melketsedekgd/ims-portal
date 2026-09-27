"use client"

import { useLayoutEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Autocomplete } from "@base-ui/react/autocomplete"
import { Combobox } from "@base-ui/react/combobox"
import { Check, ChevronDown, CircleAlert, FileText, Gauge, Layers, Lock, Plus, ShieldCheck, X } from "lucide-react"
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
import { splitAssets, uniqueCaseInsensitive } from "@/features/risks/assets"
import { createRisk } from "@/features/risks/mutations"
import {
  newTreatmentStatuses,
  riskDefinitionSchema,
  type NewTreatmentStatus,
} from "@/features/risks/schema"
import { riskBand, RISK_BAND_LABEL, type ScoredRiskBand } from "@/features/risks/scoring"
import { SCALE, SEVERITY_ROWS } from "@/features/risks/components/RiskHeatMap"
import { todayInAddisAbaba } from "@/features/objectives/dates"
import { PILL, RISK_BAND_PILL, RISK_MAP_CELL } from "@/components/shared/status-styles"
import type { CreatableDepartment, ProcessOption } from "@/features/kpis/queries"
import type { RiskSuggestions } from "@/features/risks/queries"

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
  | "treatmentSolution"
  | "monitoringEvidence"
  | "treatmentOwnerTitle"
  | "treatmentStart"
  | "treatmentTarget"
  | "treatmentStatus"
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

const TREATMENT_STATUS_LABEL: Record<NewTreatmentStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
}

/**
 * Planned / In progress as a radio group. One stop in the tab order — the
 * checked option — and the arrow keys move the choice, as a native radio
 * group does.
 */
function TreatmentStatusToggle({
  id,
  value,
  onChange,
}: {
  id: string
  value: NewTreatmentStatus
  onChange: (s: NewTreatmentStatus) => void
}) {
  const buttons = useRef<(HTMLButtonElement | null)[]>([])
  const n = newTreatmentStatuses.length

  const moveTo = (i: number) => {
    const next = (i + n) % n
    onChange(newTreatmentStatuses[next])
    buttons.current[next]?.focus()
  }

  return (
    <div className="space-y-2">
      <Label id={id}>Status</Label>
      <div role="radiogroup" aria-labelledby={id} className="grid grid-cols-2 gap-2 sm:max-w-xs">
        {newTreatmentStatuses.map((status, i) => {
          const checked = value === status
          return (
            <button
              key={status}
              ref={(el) => {
                buttons.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => onChange(status)}
              onKeyDown={(e) => {
                if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                  e.preventDefault()
                  moveTo(i + 1)
                } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                  e.preventDefault()
                  moveTo(i - 1)
                }
              }}
              className={`h-11 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                checked
                  ? "border-primary bg-primary text-primary-foreground font-semibold"
                  : "border-input bg-white dark:bg-slate-950 font-medium hover:bg-slate-50 dark:hover:bg-slate-900"
              }`}
            >
              {TREATMENT_STATUS_LABEL[status]}
            </button>
          )
        })}
      </div>
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

/** Starts at its `rows` and grows to fit longer text. */
function GrowingTextarea(props: React.ComponentProps<"textarea">) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    // scrollHeight excludes the border; the box is border-box.
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`
  }, [props.value])
  return <textarea ref={ref} {...props} />
}

const lower = (s: string) => s.toLowerCase()

// Popup look shared with ColumnsBar's panel.
const POPUP =
  "flex max-h-[min(var(--available-height),20rem)] w-(--anchor-width) max-w-[calc(100vw-1rem)] origin-(--transform-origin) flex-col overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"
const OPTION =
  "group flex min-h-9 cursor-default items-center gap-2.5 rounded-md px-2 py-1.5 text-sm outline-none select-none data-highlighted:bg-slate-100 dark:data-highlighted:bg-slate-800"
const NEW_OPTION =
  "flex min-h-9 cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium text-blue-700 outline-none select-none data-highlighted:bg-blue-50 dark:text-blue-400 dark:data-highlighted:bg-blue-950/50"
const EMPTY = "px-3 py-2.5 text-sm text-muted-foreground empty:hidden"

/**
 * Affected assets as chips. The list is the department's existing assets;
 * text that matches none of them is offered as a new asset, and text with
 * commas outside brackets becomes one chip per item. Matching ignores case,
 * and an asset typed in another case takes the listed spelling.
 *
 * Base UI already removes the last chip on Backspace in an empty input.
 * It also clears every chip on Escape while the list is closed; that is
 * blocked here — one key should not undo the whole field.
 */
function AssetCombobox({
  id,
  value,
  onChange,
  suggestions,
  departmentName,
  invalid,
  describedBy,
}: {
  id: string
  value: string[]
  onChange: (assets: string[]) => void
  suggestions: string[]
  departmentName: string
  invalid: boolean
  describedBy?: string
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const chipsRef = useRef<HTMLDivElement>(null)
  const highlighted = useRef<string | undefined>(undefined)

  // Picked first so a chip kept across a department switch keeps its
  // spelling, and shows ticked, when the new department spells it otherwise.
  const options = uniqueCaseInsensitive([...value, ...suggestions])
  const q = query.replace(/\s+/g, " ").trim()
  const exact = options.find((o) => lower(o) === lower(q))
  const matches = options.filter((o) => lower(o).includes(lower(q)))
  const newAsset = q && !exact ? q : null
  // The new asset or the exact match leads: autoHighlight makes it what
  // Enter picks.
  const lead = newAsset ?? exact
  const items = lead ? [lead, ...matches.filter((o) => o !== lead)] : matches

  const change = (next: string[]) => {
    const result = next.filter((a) => value.includes(a))
    const added = next.filter((a) => !value.includes(a)).flatMap(splitAssets)
    for (const a of added) {
      if (result.some((r) => lower(r) === lower(a))) continue
      result.push(options.find((o) => lower(o) === lower(a)) ?? a)
    }
    onChange(result)
    if (added.length > 0) setQuery("")
  }

  return (
    <Combobox.Root
      multiple
      items={items}
      filter={null}
      value={value}
      onValueChange={change}
      inputValue={query}
      onInputValueChange={setQuery}
      open={open}
      onOpenChange={setOpen}
      autoHighlight
      onItemHighlighted={(item) => {
        highlighted.current = item
      }}
    >
      <Combobox.Chips
        ref={chipsRef}
        className={`flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-lg border bg-white px-1 py-[3px] text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 dark:bg-slate-950 ${
          invalid ? "border-destructive ring-3 ring-destructive/20" : "border-input"
        }`}
      >
        {value.map((asset) => (
          <Combobox.Chip
            key={asset}
            className="inline-flex h-7 max-w-full min-w-0 items-center gap-0.5 rounded-full border border-slate-200 bg-slate-100 pr-0.5 pl-2.5 text-[13px] outline-none data-highlighted:ring-2 data-highlighted:ring-ring/50 dark:border-slate-700 dark:bg-slate-800"
          >
            <span className="truncate">{asset}</span>
            <Combobox.ChipRemove
              aria-label={`Remove ${asset}`}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-slate-100"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </Combobox.ChipRemove>
          </Combobox.Chip>
        ))}
        <Combobox.Input
          id={id}
          placeholder="Search or add an asset…"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !open) e.preventBaseUIHandler()
            // Base UI's Enter picks the highlighted option, or only closes
            // the list when none is — after the pointer leaves it, or with
            // the list closed by Escape. Either way, add what is typed.
            if (e.key === "Enter" && q && (!open || highlighted.current === undefined)) {
              e.preventBaseUIHandler()
              e.preventDefault()
              change([...value, q])
            }
          }}
          className="h-7 min-w-48 flex-1 bg-transparent px-1.5 outline-none placeholder:text-muted-foreground"
        />
      </Combobox.Chips>

      <Combobox.Portal>
        <Combobox.Positioner anchor={chipsRef} sideOffset={4} collisionPadding={8} className="isolate z-50">
          <Combobox.Popup className={POPUP}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 py-1 pr-1 pl-3 text-xs text-muted-foreground dark:border-slate-800">
              <span>
                {suggestions.length} in {departmentName}&apos;s risks · {value.length} picked
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-8 rounded-md px-2.5 text-sm font-semibold text-foreground hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Done
              </button>
            </div>
            <Combobox.Empty className={EMPTY}>
              No assets in {departmentName}&apos;s risks yet. Type one and press Enter.
            </Combobox.Empty>
            <Combobox.List className="min-h-0 overflow-y-auto p-1 empty:hidden">
              {(item: string) =>
                item === newAsset ? (
                  <Combobox.Item key={`new:${item}`} value={item} className={NEW_OPTION}>
                    <Plus className="h-4 w-4 shrink-0" aria-hidden />
                    <span>Add &ldquo;{item}&rdquo;</span>
                  </Combobox.Item>
                ) : (
                  <Combobox.Item key={item} value={item} className={OPTION}>
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-400 bg-white text-white group-data-selected:border-slate-900 group-data-selected:bg-slate-900 dark:bg-slate-950 dark:group-data-selected:border-slate-100 dark:group-data-selected:bg-slate-100 dark:group-data-selected:text-slate-900">
                      <Check className="invisible h-3 w-3 group-data-selected:visible" strokeWidth={3} aria-hidden />
                    </span>
                    <span>{item}</span>
                  </Combobox.Item>
                )
              }
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

/**
 * Risk owner as free text with the department's titles to pick from.
 * Autocomplete rather than a single-value Combobox: the input is the value,
 * so a title nobody has used yet is kept as typed — a Combobox resets
 * unmatched text to the last pick on close. As with the assets, Escape on a
 * closed list would clear the field and is blocked.
 */
function OwnerCombobox({
  id,
  value,
  onChange,
  titles,
  departmentName,
  invalid,
  describedBy,
}: {
  id: string
  value: string
  onChange: (title: string) => void
  titles: string[]
  departmentName: string
  invalid: boolean
  describedBy?: string
}) {
  const [open, setOpen] = useState(false)

  const q = value.trim()
  const exact = titles.some((t) => lower(t) === lower(q))
  const newTitle = q && !exact ? q : null
  // An exact match lists every title, as an empty box does, so switching
  // to another stays one click away.
  const items = newTitle
    ? [newTitle, ...titles.filter((t) => lower(t).includes(lower(q)))]
    : titles

  return (
    <Autocomplete.Root
      items={items}
      filter={null}
      value={value}
      onValueChange={onChange}
      open={open}
      onOpenChange={setOpen}
    >
      <div className="relative">
        <Autocomplete.Input
          id={id}
          placeholder="Pick or type a job title"
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          onKeyDown={(e) => {
            if (e.key === "Escape" && !open) e.preventBaseUIHandler()
          }}
          className="h-8 w-full min-w-0 rounded-lg border border-input bg-white py-1 pr-9 pl-2.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-slate-950"
        />
        <Autocomplete.Trigger
          aria-label="Show owner titles"
          className="absolute inset-y-0 right-0 flex w-8 items-center justify-center text-muted-foreground hover:text-foreground"
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </Autocomplete.Trigger>
      </div>

      <Autocomplete.Portal>
        <Autocomplete.Positioner sideOffset={4} collisionPadding={8} className="isolate z-50">
          <Autocomplete.Popup className={POPUP}>
            <Autocomplete.Empty className={EMPTY}>
              No owner titles in {departmentName}&apos;s risks yet.
            </Autocomplete.Empty>
            <Autocomplete.List className="min-h-0 overflow-y-auto p-1 empty:hidden">
              {(item: string) =>
                item === newTitle ? (
                  <Autocomplete.Item key={`new:${item}`} value={item} className={NEW_OPTION}>
                    Use &ldquo;{item}&rdquo; as a new title
                  </Autocomplete.Item>
                ) : (
                  <Autocomplete.Item
                    key={item}
                    value={item}
                    data-current={lower(item) === lower(q) || undefined}
                    className={`${OPTION} justify-between data-current:font-semibold`}
                  >
                    <span>{item}</span>
                    {lower(item) === lower(q) && <Check className="h-4 w-4 shrink-0" aria-hidden />}
                  </Autocomplete.Item>
                )
              }
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  )
}

const NO_SUGGESTIONS: RiskSuggestions = { assets: [], ownerTitles: [] }

/**
 * Create-risk form. Every option list comes from the server component that
 * renders it; nothing here decides permissions. The fields are checked
 * against riskDefinitionSchema before sending so each error sits under its
 * field; a refusal from createRisk is shown in the banner — the database is
 * the authority on who may create.
 *
 * Severity and likelihood start unpicked. They become the risk's baseline,
 * and a default would save a starting score nobody chose.
 *
 * The treatment is required; its start date defaults to today and its
 * status to Planned. Its owner follows the risk owner until edited.
 */
export default function RiskDefinitionForm({
  departments,
  processes,
  suggestions,
}: {
  departments: CreatableDepartment[]
  processes: ProcessOption[]
  suggestions: Record<string, RiskSuggestions>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "")
  const [processId, setProcessId] = useState("")
  const [affectedAssets, setAffectedAssets] = useState<string[]>([])
  const [threat, setThreat] = useState("")
  const [vulnerability, setVulnerability] = useState("")
  const [riskStatement, setRiskStatement] = useState("")
  const [riskOwnerTitle, setRiskOwnerTitle] = useState("")
  const [severity, setSeverity] = useState<number | null>(null)
  const [likelihood, setLikelihood] = useState<number | null>(null)
  const [treatmentSolution, setTreatmentSolution] = useState("")
  const [monitoringEvidence, setMonitoringEvidence] = useState("")
  // null until the treatment owner is edited directly; until then it shows
  // and submits whatever the risk owner says.
  const [treatmentOwnerOverride, setTreatmentOwnerOverride] = useState<string | null>(null)
  const treatmentOwnerTitle = treatmentOwnerOverride ?? riskOwnerTitle
  const [treatmentStart, setTreatmentStart] = useState(todayInAddisAbaba)
  const [treatmentTarget, setTreatmentTarget] = useState("")
  const [treatmentStatus, setTreatmentStatus] = useState<NewTreatmentStatus>("planned")

  const [errors, setErrors] = useState<FieldErrors>({})
  const [banner, setBanner] = useState<string | null>(null)

  /** Wraps a setter so editing a field clears its error. */
  const edit =
    <T,>(field: Field, set: (v: T) => void) =>
    (v: T) => {
      set(v)
      setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e))
    }

  // All creatable departments' processes and suggestions were fetched up
  // front; switching department is a filter, not a refetch. The chosen
  // process is cleared so a process from the previous department cannot be
  // submitted — create_risk_with_baseline() would refuse it anyway. Picked
  // assets and the owner are text, valid in any department, and are kept.
  const department = departments.find((d) => d.id === departmentId)
  const departmentName = department?.name ?? "the department"
  const departmentProcesses = processes.filter((p) => p.departmentId === departmentId)
  const departmentSuggestions = suggestions[departmentId] ?? NO_SUGGESTIONS
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

  // A "before the start date" error on the target is about both dates, so
  // moving the start clears it too.
  const changeTreatmentStart = edit("treatmentStart", (v: string) => {
    setTreatmentStart(v)
    setErrors((e) => (e.treatmentTarget ? { ...e, treatmentTarget: undefined } : e))
  })

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
      treatmentSolution,
      monitoringEvidence,
      treatmentOwnerTitle,
      treatmentStart,
      treatmentTarget,
      treatmentStatus,
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
        <div className="min-w-0 space-y-6">
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
              <AssetCombobox
                id="risk-assets"
                value={affectedAssets}
                onChange={edit("affectedAssets", setAffectedAssets)}
                suggestions={departmentSuggestions.assets}
                departmentName={departmentName}
                invalid={!!errors.affectedAssets}
                describedBy={describedBy("affectedAssets", "risk-assets-hint")}
              />
              <FieldError id="risk-affectedAssets-error" message={errors.affectedAssets} />
              <p id="risk-assets-hint" className="text-xs text-muted-foreground">
                Pick from assets already in {departmentName}&apos;s risks, or type a new one and press Enter
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-threat">Threat <Optional /></Label>
              <GrowingTextarea
                id="risk-threat"
                rows={2}
                className={textareaClass}
                placeholder="What could happen"
                value={threat}
                onChange={(e) => edit("threat", setThreat)(e.target.value)}
                aria-invalid={errors.threat ? true : undefined}
                aria-describedby={describedBy("threat")}
              />
              <FieldError id="risk-threat-error" message={errors.threat} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-vulnerability">Vulnerability <Optional /></Label>
              <GrowingTextarea
                id="risk-vulnerability"
                rows={2}
                className={textareaClass}
                placeholder="The weakness it exploits"
                value={vulnerability}
                onChange={(e) => edit("vulnerability", setVulnerability)(e.target.value)}
                aria-invalid={errors.vulnerability ? true : undefined}
                aria-describedby={describedBy("vulnerability")}
              />
              <FieldError id="risk-vulnerability-error" message={errors.vulnerability} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="risk-statement">Risk statement <Optional /></Label>
              <GrowingTextarea
                id="risk-statement"
                rows={2}
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
              <OwnerCombobox
                id="risk-owner"
                value={riskOwnerTitle}
                onChange={edit("riskOwnerTitle", setRiskOwnerTitle)}
                titles={departmentSuggestions.ownerTitles}
                departmentName={departmentName}
                invalid={!!errors.riskOwnerTitle}
                describedBy={describedBy("riskOwnerTitle", "risk-owner-hint")}
              />
              <FieldError id="risk-riskOwnerTitle-error" message={errors.riskOwnerTitle} />
              <p id="risk-owner-hint" className="text-xs text-muted-foreground">
                Titles already used in {departmentName}&apos;s risks; type a new one if it isn&apos;t listed
              </p>
            </div>
          </Section>

          <Section
            icon={<ShieldCheck className="h-4 w-4" />}
            title="Treatment"
            hint="How the risk will be reduced. Quarterly reviews are added from the risk's page."
          >
            <div className="space-y-2">
              <Label htmlFor="treatment-solution">Treatment solution <Req /></Label>
              <GrowingTextarea
                id="treatment-solution"
                rows={3}
                className={textareaClass}
                placeholder="What will be done to reduce the risk"
                value={treatmentSolution}
                onChange={(e) => edit("treatmentSolution", setTreatmentSolution)(e.target.value)}
                aria-invalid={errors.treatmentSolution ? true : undefined}
                aria-describedby={describedBy("treatmentSolution")}
              />
              <FieldError id="risk-treatmentSolution-error" message={errors.treatmentSolution} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="treatment-evidence">Monitoring evidence <Optional /></Label>
              <GrowingTextarea
                id="treatment-evidence"
                rows={2}
                className={textareaClass}
                value={monitoringEvidence}
                onChange={(e) => edit("monitoringEvidence", setMonitoringEvidence)(e.target.value)}
                aria-invalid={errors.monitoringEvidence ? true : undefined}
                aria-describedby={describedBy("monitoringEvidence", "treatment-evidence-hint")}
              />
              <FieldError id="risk-monitoringEvidence-error" message={errors.monitoringEvidence} />
              <p id="treatment-evidence-hint" className="text-xs text-muted-foreground">
                Where the proof will be, e.g. a dashboard or a report
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="treatment-owner">Owner <Optional /></Label>
              <OwnerCombobox
                id="treatment-owner"
                value={treatmentOwnerTitle}
                onChange={edit("treatmentOwnerTitle", setTreatmentOwnerOverride)}
                titles={departmentSuggestions.ownerTitles}
                departmentName={departmentName}
                invalid={!!errors.treatmentOwnerTitle}
                describedBy={describedBy("treatmentOwnerTitle", "treatment-owner-hint")}
              />
              <FieldError id="risk-treatmentOwnerTitle-error" message={errors.treatmentOwnerTitle} />
              <p id="treatment-owner-hint" className="text-xs text-muted-foreground">
                {treatmentOwnerOverride === null
                  ? "Follows the risk owner until you change it"
                  : `Titles already used in ${departmentName}'s risks; type a new one if it isn't listed`}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="treatment-start">Start date <Optional /></Label>
                <Input
                  id="treatment-start"
                  type="date"
                  value={treatmentStart}
                  max={treatmentTarget || undefined}
                  onChange={(e) => changeTreatmentStart(e.target.value)}
                  aria-invalid={errors.treatmentStart ? true : undefined}
                  aria-describedby={describedBy("treatmentStart")}
                  className="bg-white dark:bg-slate-950"
                />
                <FieldError id="risk-treatmentStart-error" message={errors.treatmentStart} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="treatment-target">Target date <Req /></Label>
                <Input
                  id="treatment-target"
                  type="date"
                  value={treatmentTarget}
                  min={treatmentStart || undefined}
                  onChange={(e) => edit("treatmentTarget", setTreatmentTarget)(e.target.value)}
                  aria-invalid={errors.treatmentTarget ? true : undefined}
                  aria-describedby={describedBy("treatmentTarget")}
                  className="bg-white dark:bg-slate-950"
                />
                <FieldError id="risk-treatmentTarget-error" message={errors.treatmentTarget} />
              </div>
            </div>

            <TreatmentStatusToggle
              id="treatment-status"
              value={treatmentStatus}
              onChange={edit("treatmentStatus", setTreatmentStatus)}
            />
          </Section>
        </div>

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
