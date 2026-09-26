"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { ArrowRight, Lock } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { saveSignoffSettings } from "@/features/signoff/mutations"
import type { SignoffSettingsItem, SubmitRole } from "@/features/signoff/queries"
import ApprovalSettingsHeader, { type SettingsTab } from "./ApprovalSettingsHeader"

/** One department's settings as the admin is editing them. */
type Draft = { submitRole: SubmitRole; managerApproval: boolean }

const SUBMIT_OPTIONS: { value: SubmitRole; label: string }[] = [
  { value: "contributor_or_manager", label: "Contributors and managers" },
  { value: "manager_only", label: "Managers only" },
]

const COLUMNS = "xl:grid-cols-[minmax(0,1fr)_220px_150px_170px_minmax(0,1.4fr)]"

const toDraft = (d: SignoffSettingsItem): Draft => ({ submitRole: d.submitRole, managerApproval: d.managerApproval })
const sameDraft = (a: Draft, b: Draft) => a.submitRole === b.submitRole && a.managerApproval === b.managerApproval

/** The steps a quarter goes through under these settings. */
function flow(d: Draft): string[] {
  return [
    d.submitRole === "manager_only" ? "Manager submits" : "Contributor or manager submits",
    ...(d.managerApproval ? ["Manager approves"] : []),
    "IMS Manager receives",
  ]
}

/**
 * The Approval settings page's Quarter sign-off tab: who submits each
 * participating department's quarter, and whether its manager approves it
 * before the IMS Manager receives it.
 */
export default function SignoffSettings({
  departments,
  unsaved,
  onDirtyChange,
}: {
  departments: SignoffSettingsItem[]
  unsaved: Record<SettingsTab, boolean>
  onDirtyChange: (dirty: boolean) => void
}) {
  return (
    // Keyed on the saved data, as the Documents tab is: after a save the
    // editor starts again from what the database now holds.
    <SignoffEditor
      key={JSON.stringify(departments)}
      departments={departments}
      unsaved={unsaved}
      onDirtyChange={onDirtyChange}
    />
  )
}

function SignoffEditor({
  departments,
  unsaved,
  onDirtyChange,
}: {
  departments: SignoffSettingsItem[]
  unsaved: Record<SettingsTab, boolean>
  onDirtyChange: (dirty: boolean) => void
}) {
  const participants = departments.filter((d) => d.takesPart)
  const others = departments.filter((d) => !d.takesPart)

  const [saved] = useState(() => Object.fromEntries(participants.map((d) => [d.departmentId, toDraft(d)])))
  const [drafts, setDrafts] = useState(saved)
  const [pending, startTransition] = useTransition()

  const changed = participants.filter((d) => !sameDraft(drafts[d.departmentId], saved[d.departmentId]))
  const dirty = changed.length > 0
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange])

  const patch = (departmentId: string, change: Partial<Draft>) =>
    setDrafts((all) => ({ ...all, [departmentId]: { ...all[departmentId], ...change } }))

  const save = () => {
    startTransition(async () => {
      const r = await saveSignoffSettings({
        departments: changed.map((d) => ({ departmentId: d.departmentId, ...drafts[d.departmentId] })),
      })
      if (r.ok) toast.success("Sign-off settings saved.")
      else toast.error(r.message)
    })
  }

  return (
    <div className="space-y-6">
      <ApprovalSettingsHeader
        tab="signoff"
        description="Choose which steps each approval goes through. Changes apply from the next submission — a quarter already submitted finishes on the settings it started with."
        unsaved={unsaved}
        dirty={dirty}
        pending={pending}
        onSave={save}
        onDiscard={() => setDrafts(saved)}
      />

      <p className="text-sm text-muted-foreground">
        One sign-off per department per quarter, covering KPIs, objectives and risks together.
      </p>

      <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className={`hidden xl:grid ${COLUMNS} gap-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground`}>
          <div>Department</div>
          <div>Who can submit</div>
          <div>Manager approval</div>
          <div>IMS Manager receives</div>
          <div>Resulting flow</div>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {participants.length === 0 && (
            <p className="px-6 py-5 text-sm text-muted-foreground">
              No active department takes part in quarter sign-off.
            </p>
          )}

          {participants.map((d) => {
            const draft = drafts[d.departmentId]
            const selectId = `submit-role-${d.departmentId}`
            return (
              <div
                key={d.departmentId}
                className={`grid grid-cols-1 sm:grid-cols-2 ${COLUMNS} items-center gap-x-5 gap-y-4 px-6 py-4`}
              >
                <div className="sm:col-span-2 xl:col-span-1">
                  <p className="text-sm font-semibold">{d.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-muted-foreground">{d.code}</p>
                </div>

                <div className="space-y-1">
                  <label htmlFor={selectId} className="text-xs text-muted-foreground">Submitted by</label>
                  <Select
                    value={draft.submitRole}
                    onValueChange={(v) => v && patch(d.departmentId, { submitRole: v as SubmitRole })}
                    disabled={pending}
                    items={SUBMIT_OPTIONS}
                  >
                    <SelectTrigger id={selectId} className="w-full bg-white dark:bg-slate-950">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBMIT_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground xl:hidden">Manager approval</p>
                  <label className="flex min-h-11 w-fit cursor-pointer items-center gap-2.5 text-sm font-medium text-ink-2 dark:text-slate-300">
                    <Switch
                      checked={draft.managerApproval}
                      onCheckedChange={(v) => patch(d.departmentId, { managerApproval: v })}
                      disabled={pending}
                      aria-label={`Manager approval for ${d.code}`}
                      className="data-checked:bg-coral"
                    />
                    <span>{draft.managerApproval ? "Required" : "Skipped"}</span>
                  </label>
                </div>

                <div className="flex flex-col items-start gap-1">
                  <p className="text-xs text-muted-foreground xl:hidden">IMS Manager receives</p>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1.5 text-xs font-semibold text-muted-foreground">
                    <Lock className="h-3 w-3" aria-hidden />
                    Required
                  </span>
                  <span className="text-xs text-muted-foreground">Locks the quarter</span>
                </div>

                <div className="sm:col-span-2 xl:col-span-1">
                  <p className="mb-1.5 text-xs text-muted-foreground xl:hidden">Resulting flow</p>
                  <ol className="flex flex-wrap items-center gap-2">
                    {flow(draft).map((label, i) => (
                      <li key={label} className="flex items-center gap-2">
                        {i > 0 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />}
                        <span className="rounded-full bg-[var(--coral-tint)] px-3 py-1.5 text-sm font-medium text-[var(--coral-600)]">
                          {label}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )
          })}

          {others.map((d) => (
            <div
              key={d.departmentId}
              className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,4fr)] items-center gap-x-5 gap-y-2 bg-slate-50 dark:bg-slate-900/40 px-6 py-4"
            >
              <div>
                <p className="text-sm font-semibold text-muted-foreground">{d.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted-foreground">{d.code}</p>
              </div>
              <p className="text-sm text-muted-foreground">Doesn&rsquo;t take part in quarter sign-off.</p>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 rounded-xl bg-slate-100 dark:bg-slate-900 px-6 py-5">
        <h3 className="text-base font-semibold">Always enforced</h3>
        <p className="text-sm text-ink-2 dark:text-slate-300">Submitting needs every KPI and objective entered for the quarter.</p>
        <p className="text-sm text-ink-2 dark:text-slate-300">Once submitted, a quarter is locked. Only a return unlocks it.</p>
        <p className="text-sm text-ink-2 dark:text-slate-300">A return always needs a reason.</p>
        <p className="text-sm text-ink-2 dark:text-slate-300">Without manager approval, a submission goes straight to the IMS Manager.</p>
      </div>
    </div>
  )
}
