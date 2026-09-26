"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Lock, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import PageHeader from "@/components/shared/PageHeader"
import { saveWorkflowSettings } from "@/features/documents/mutations"
import { EXTRA_REVIEWER_ROLE_LABEL, type CoordinatorRole, type ExtraReviewerRole } from "@/features/documents/workflow"
import type { WorkflowSettingsItem } from "@/features/documents/queries"

type Department = { id: string; name: string; code: string }
type Reviewer = { departmentId: string; role: ExtraReviewerRole }

/** One document type's steps as the admin is editing them. */
type Draft = {
  coordinatorReviewEnabled: boolean
  coordinatorReviewRole: CoordinatorRole
  draftCheckEnabled: boolean
  draftCheckRole: CoordinatorRole
  finalEnabled: boolean
  extraReviewers: Reviewer[]
}

const MAX_REVIEWERS = 3

const DECIDED_BY_OPTIONS: { value: CoordinatorRole; label: string }[] = [
  { value: "any", label: "Either coordinator" },
  { value: "qms_coordinator", label: "QMS Coordinator only" },
  { value: "isms_coordinator", label: "ISMS Coordinator only" },
]

const ROLE_OPTIONS = (Object.keys(EXTRA_REVIEWER_ROLE_LABEL) as ExtraReviewerRole[]).map((r) => ({
  value: r,
  label: EXTRA_REVIEWER_ROLE_LABEL[r],
}))

function toDraft(t: WorkflowSettingsItem): Draft {
  return {
    coordinatorReviewEnabled: t.coordinatorReviewEnabled,
    coordinatorReviewRole: t.coordinatorReviewRole,
    draftCheckEnabled: t.draftCheckEnabled,
    draftCheckRole: t.draftCheckRole,
    finalEnabled: t.finalEnabled,
    extraReviewers: t.extraReviewers.map((x) => ({ departmentId: x.departmentId, role: x.role })),
  }
}

const sameDraft = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b)

type StepDef = {
  key: "owner" | "coordinator_review" | "extra_review" | "ims" | "draft_check" | "ims_document" | "final" | "document_control"
  phase: 1 | 2
  name: string
  short: string
  desc?: string
  /** Fixed "Decided by" text; a step with a choice has none. */
  decidedBy?: string
}

const STEPS: StepDef[] = [
  { key: "owner", phase: 1, name: "Owner review", short: "Owner", desc: "The document's department manager approves the request.", decidedBy: "Department Manager" },
  { key: "coordinator_review", phase: 1, name: "Coordinator review", short: "Coordinator", desc: "Checks the request against the management system." },
  { key: "extra_review", phase: 1, name: "Other departments' review", short: "Other depts" },
  { key: "ims", phase: 1, name: "IMS Manager approval", short: "IMS Manager", desc: "Gives permission to start drafting.", decidedBy: "IMS Manager" },
  { key: "draft_check", phase: 2, name: "Draft check", short: "Draft check", desc: "A coordinator checks the requester's draft." },
  { key: "ims_document", phase: 2, name: "IMS Manager draft approval", short: "IMS Manager", desc: "Approves the finished draft.", decidedBy: "IMS Manager" },
  { key: "final", phase: 2, name: "Final approval", short: "CTO/VP", desc: "Executive sign-off before publishing.", decidedBy: "CTO/VP" },
  { key: "document_control", phase: 2, name: "Document control", short: "Document control", desc: "Publishes the new revision, or retires the document.", decidedBy: "Either coordinator" },
]

function isOn(d: Draft, key: StepDef["key"]): boolean {
  switch (key) {
    case "coordinator_review": return d.coordinatorReviewEnabled
    case "draft_check": return d.draftCheckEnabled
    case "final": return d.finalEnabled
    case "extra_review": return d.extraReviewers.length > 0
    default: return true
  }
}

const stepCount = (d: Draft) => STEPS.filter((s) => isOn(d, s.key)).length

const docsLabel = (n: number) => (n === 0 ? "No documents yet" : n === 1 ? "1 document" : `${n} documents`)

/**
 * The Approval settings page's Documents tab. The selected type lives out
 * here so it survives the editor remounting after a save.
 */
export default function ApprovalSettings({
  types,
  departments,
}: {
  types: WorkflowSettingsItem[]
  departments: Department[]
}) {
  const [selected, setSelected] = useState(types[0]?.documentType ?? "")
  return (
    // Keyed on the saved data: after a save the page re-renders with what the
    // database now holds, and the editor starts again from that — clean on
    // success, showing what did get saved if a save stopped part way.
    <SettingsEditor
      key={JSON.stringify(types)}
      types={types}
      departments={departments}
      selected={selected}
      onSelect={setSelected}
    />
  )
}

function SettingsEditor({
  types,
  departments,
  selected,
  onSelect,
}: {
  types: WorkflowSettingsItem[]
  departments: Department[]
  selected: string
  onSelect: (key: string) => void
}) {
  const [saved] = useState(() => Object.fromEntries(types.map((t) => [t.documentType, toDraft(t)])))
  const [drafts, setDrafts] = useState(saved)
  const [pending, startTransition] = useTransition()

  const changed = types.filter((t) => !sameDraft(drafts[t.documentType], saved[t.documentType]))
  const dirty = changed.length > 0

  const type = types.find((t) => t.documentType === selected) ?? types[0]
  if (!type) {
    return <p className="text-sm text-muted-foreground">No document types are set up yet.</p>
  }
  const draft = drafts[type.documentType]
  // A saved reviewer's department may since have been made inactive, so it
  // is not among the ones offered; its code still comes from the saved row.
  const codes: Record<string, string> = Object.fromEntries([
    ...types.flatMap((t) => t.extraReviewers.map((x) => [x.departmentId, x.departmentCode])),
    ...departments.map((d) => [d.id, d.code]),
  ])

  const patch = (change: Partial<Draft>) =>
    setDrafts((all) => ({ ...all, [type.documentType]: { ...all[type.documentType], ...change } }))

  const save = () => {
    startTransition(async () => {
      const r = await saveWorkflowSettings({
        types: changed.map((t) => ({ documentType: t.documentType, ...drafts[t.documentType] })),
      })
      if (r.ok) toast.success("Approval settings saved.")
      else toast.error(r.message)
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval settings"
        description="Choose which steps each approval goes through. Changes apply to requests raised after you save — requests already in progress finish on the settings they started with."
        actions={
          dirty ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--coral-600)]">Unsaved changes</span>
              <Button variant="outline" onClick={() => setDrafts(saved)} disabled={pending}>Discard</Button>
              <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">All changes saved</span>
          )
        }
      />

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        <span aria-current="page" className="-mb-px border-b-[3px] border-coral px-4 py-2.5 text-sm font-semibold text-ink dark:text-slate-100">
          Documents
        </span>
      </div>

      <div className="flex flex-col lg:flex-row gap-7 items-start">
        {/* ── Document types ── */}
        <div className="w-full lg:w-[260px] shrink-0 space-y-2">
          <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Document type</p>
          {types.map((t) => {
            const isSelected = t.documentType === type.documentType
            return (
              <button
                key={t.documentType}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(t.documentType)}
                className={cn(
                  "flex w-full flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors",
                  isSelected
                    ? "border-coral bg-white dark:bg-slate-950"
                    : "border-slate-200 dark:border-slate-800 hover:bg-white/60 dark:hover:bg-slate-900"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  {t.name}
                  {changed.some((c) => c.documentType === t.documentType) && (
                    <span className="size-1.5 rounded-full bg-coral" aria-label="Unsaved changes" />
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {stepCount(drafts[t.documentType])} steps · {docsLabel(t.documentCount)}
                </span>
              </button>
            )
          })}
        </div>

        {/* ── The selected type ── */}
        <div className="w-full min-w-0 flex-1 space-y-5">
          <TypeHeading type={type} draft={draft} />
          <Preview draft={draft} />
          {([1, 2] as const).map((phase) => (
            <PhaseCard
              key={phase}
              phase={phase}
              draft={draft}
              departments={departments}
              codes={codes}
              disabled={pending}
              onChange={patch}
            />
          ))}

          <div className="space-y-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 px-6 py-5">
            <h3 className="text-base font-semibold">Always enforced</h3>
            <p className="text-sm text-ink-2 dark:text-slate-300">Nobody decides a stage of their own request.</p>
            <p className="text-sm text-ink-2 dark:text-slate-300">Owner review, both IMS Manager steps and document control can&rsquo;t be switched off.</p>
            <p className="text-sm text-ink-2 dark:text-slate-300">A rejection in phase 1 ends the request; in phase 2 it returns the draft.</p>
            <p className="text-sm text-ink-2 dark:text-slate-300">At most 3 other-department reviewers per document type.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function TypeHeading({ type, draft }: { type: WorkflowSettingsItem; draft: Draft }) {
  const off = [draft.coordinatorReviewEnabled, draft.draftCheckEnabled, draft.finalEnabled].filter((on) => !on).length
  const n = type.documentCount
  const uses = n === 0 ? "No documents use this workflow yet." : n === 1 ? "1 document uses this workflow." : `${n} documents use this workflow.`
  const summary = off === 0 ? "Every step is on." : `${off} optional ${off === 1 ? "step is" : "steps are"} switched off.`
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-ink dark:text-slate-100">{type.name} workflow</h2>
      <p className="mt-1 text-sm text-muted-foreground">{uses} {summary}</p>
    </div>
  )
}

/** Numbers the steps that are on, across both phases; a skipped step gets none. */
function numbered(draft: Draft) {
  let n = 0
  return STEPS.map((s) => {
    const on = isOn(draft, s.key)
    return { ...s, on, num: on ? ++n : null }
  })
}

function Preview({ draft }: { draft: Draft }) {
  const steps = numbered(draft).filter((s) => s.on)
  const track = (phase: 1 | 2) => {
    const list = steps.filter((s) => s.phase === phase)
    return (
      <div className="space-y-3">
        <p className="text-sm font-semibold text-ink-2 dark:text-slate-300">
          {phase === 1 ? "Phase 1 — Permission" : "Phase 2 — Draft"}
        </p>
        <ol className="relative flex">
          {list.length > 1 && (
            <span aria-hidden className="absolute top-[14px] left-[54px] right-[54px] h-[3px] bg-slate-200 dark:bg-slate-800" />
          )}
          {list.map((s) => (
            <li key={s.key} className="relative flex w-[108px] flex-col items-center gap-2 text-center">
              <span className="flex size-[31px] items-center justify-center rounded-full border-[3px] border-coral bg-white dark:bg-slate-950 font-mono text-xs text-[var(--coral-600)]">
                {s.num}
              </span>
              <span className="text-xs leading-snug text-ink-2 dark:text-slate-300">{s.short}</span>
            </li>
          ))}
        </ol>
      </div>
    )
  }
  return (
    <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-6 py-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What requesters will see</p>
      <div className="flex gap-10 overflow-x-auto">
        {track(1)}
        {track(2)}
      </div>
      <p className="text-sm text-muted-foreground">Deletion requests stop after phase 1 and go straight to document control.</p>
    </div>
  )
}

function PhaseCard({
  phase,
  draft,
  departments,
  codes,
  disabled,
  onChange,
}: {
  phase: 1 | 2
  draft: Draft
  departments: Department[]
  codes: Record<string, string>
  disabled: boolean
  onChange: (change: Partial<Draft>) => void
}) {
  const steps = numbered(draft).filter((s) => s.phase === phase)
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-4">
        <h3 className="text-base font-semibold">{phase === 1 ? "Phase 1 — Permission" : "Phase 2 — Draft"}</h3>
        <span className="text-sm text-muted-foreground">
          {phase === 1 ? "Approve the request before anyone drafts." : "Approve the draft before it's published."}
        </span>
      </div>
      {steps.map((s) =>
        s.key === "extra_review" ? (
          <ExtraReviewRow key={s.key} num={s.num} draft={draft} departments={departments} codes={codes} disabled={disabled} onChange={onChange} />
        ) : (
          <StepRow key={s.key} step={s} num={s.num} draft={draft} disabled={disabled} onChange={onChange} />
        )
      )}
    </div>
  )
}

function StepNumber({ num }: { num: number | null }) {
  return (
    <span
      className={cn(
        "flex size-[30px] shrink-0 items-center justify-center rounded-full font-mono text-xs",
        num === null
          ? "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"
          : "bg-[var(--coral-tint)] text-[var(--coral-600)]"
      )}
    >
      {num ?? "–"}
    </span>
  )
}

function StepRow({
  step,
  num,
  draft,
  disabled,
  onChange,
}: {
  step: StepDef
  num: number | null
  draft: Draft
  disabled: boolean
  onChange: (change: Partial<Draft>) => void
}) {
  const on = num !== null
  const toggle =
    step.key === "coordinator_review" ? (v: boolean) => onChange({ coordinatorReviewEnabled: v })
    : step.key === "draft_check" ? (v: boolean) => onChange({ draftCheckEnabled: v })
    : step.key === "final" ? (v: boolean) => onChange({ finalEnabled: v })
    : null
  const role =
    step.key === "coordinator_review" ? { value: draft.coordinatorReviewRole, set: (v: CoordinatorRole) => onChange({ coordinatorReviewRole: v }) }
    : step.key === "draft_check" ? { value: draft.draftCheckRole, set: (v: CoordinatorRole) => onChange({ draftCheckRole: v }) }
    : null
  const roleId = `decided-by-${step.key}`

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 border-t border-slate-100 dark:border-slate-800 px-5 py-3.5">
      <div className={cn("flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center gap-4", !on && "opacity-45")}>
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <StepNumber num={num} />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{step.name}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">{step.desc}</p>
          </div>
        </div>
        <div className="w-full sm:w-[210px] shrink-0 pl-[46px] sm:pl-0">
          {role ? (
            <div className="space-y-1">
              <label htmlFor={roleId} className="text-xs text-muted-foreground">Decided by</label>
              <Select
                value={role.value}
                onValueChange={(v) => v && role.set(v as CoordinatorRole)}
                disabled={disabled || !on}
                items={DECIDED_BY_OPTIONS}
              >
                <SelectTrigger id={roleId} className="w-full bg-white dark:bg-slate-950">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DECIDED_BY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <p className="text-xs text-muted-foreground">Decided by</p>
              <p className="mt-1 text-sm font-medium">{step.decidedBy}</p>
            </div>
          )}
        </div>
      </div>
      <div className="flex w-[112px] shrink-0 justify-end self-end sm:self-auto">
        {toggle ? (
          <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm font-medium text-ink-2 dark:text-slate-300">
            <Switch
              checked={on}
              onCheckedChange={toggle}
              disabled={disabled}
              aria-label={step.name}
              className="data-checked:bg-coral"
            />
            <span className="w-7">{on ? "On" : "Off"}</span>
          </label>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            Required
          </span>
        )}
      </div>
    </div>
  )
}

function ExtraReviewRow({
  num,
  draft,
  departments,
  codes,
  disabled,
  onChange,
}: {
  num: number | null
  draft: Draft
  departments: Department[]
  codes: Record<string, string>
  disabled: boolean
  onChange: (change: Partial<Draft>) => void
}) {
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "")
  const [role, setRole] = useState<ExtraReviewerRole>("department_manager")

  const reviewers = draft.extraReviewers
  const full = reviewers.length >= MAX_REVIEWERS
  const duplicate = reviewers.some((r) => r.departmentId === departmentId && r.role === role)

  const add = () => {
    if (!departmentId || full || duplicate) return
    onChange({ extraReviewers: [...reviewers, { departmentId, role }] })
  }

  return (
    <div className="flex gap-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-5 py-3.5">
      <StepNumber num={num} />
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <p className="text-sm font-semibold">Other departments&rsquo; review</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Everyone listed is asked at the same time. All must approve; any rejection ends the request.
            </p>
          </div>
          <span className="whitespace-nowrap text-xs font-semibold text-muted-foreground">
            {reviewers.length} of {MAX_REVIEWERS} added
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {reviewers.length === 0 ? (
            <span className="text-sm text-muted-foreground">No other departments added, so this step is skipped.</span>
          ) : (
            reviewers.map((r, i) => {
              const label = `${EXTRA_REVIEWER_ROLE_LABEL[r.role]} · ${codes[r.departmentId] ?? "—"}`
              return (
                <span
                  key={`${r.departmentId}:${r.role}`}
                  className="inline-flex items-center gap-1 rounded-full bg-[var(--coral-tint)] py-0.5 pl-3 pr-0.5 text-sm font-medium text-[var(--coral-600)]"
                >
                  {label}
                  <button
                    type="button"
                    disabled={disabled}
                    aria-label={`Remove ${label}`}
                    onClick={() => onChange({ extraReviewers: reviewers.filter((_, j) => j !== i) })}
                    className="flex size-8 items-center justify-center rounded-full hover:bg-coral/10 disabled:opacity-50"
                  >
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </span>
              )
            })
          )}
        </div>

        <div className="flex flex-wrap items-end gap-2.5">
          <div className="space-y-1">
            <label htmlFor="extra-department" className="text-xs text-muted-foreground">Department</label>
            <Select
              value={departmentId}
              onValueChange={(v) => v && setDepartmentId(v)}
              disabled={disabled || full}
              items={departments.map((d) => ({ value: d.id, label: d.name }))}
            >
              <SelectTrigger id="extra-department" className="w-[260px] max-w-full bg-white dark:bg-slate-950">
                <SelectValue placeholder="Select a department" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label htmlFor="extra-role" className="text-xs text-muted-foreground">Role</label>
            <Select
              value={role}
              onValueChange={(v) => v && setRole(v as ExtraReviewerRole)}
              disabled={disabled || full}
              items={ROLE_OPTIONS}
            >
              <SelectTrigger id="extra-role" className="w-[210px] max-w-full bg-white dark:bg-slate-950">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            onClick={add}
            disabled={disabled || full || duplicate || !departmentId}
            title={duplicate ? "Already added" : undefined}
          >
            Add reviewer
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Skipped when the request comes from that same department.</p>
      </div>
    </div>
  )
}
