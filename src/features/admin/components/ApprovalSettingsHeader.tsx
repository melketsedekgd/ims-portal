"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import PageHeader from "@/components/shared/PageHeader"

export type SettingsTab = "documents" | "signoff"

const TABS: { key: SettingsTab; label: string; href: string }[] = [
  { key: "documents", label: "Documents", href: "/admin/approval-settings" },
  { key: "signoff", label: "Quarter sign-off", href: "/admin/approval-settings?tab=signoff" },
]

/**
 * The page header and tab bar, rendered by each tab so its Save and Discard
 * act on that tab's changes. The tab bar marks every tab holding unsaved
 * changes, since the other tab's are kept but out of sight.
 */
export default function ApprovalSettingsHeader({
  tab,
  description,
  unsaved,
  dirty,
  pending,
  onSave,
  onDiscard,
}: {
  tab: SettingsTab
  description: string
  unsaved: Record<SettingsTab, boolean>
  dirty: boolean
  pending: boolean
  onSave: () => void
  onDiscard: () => void
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Approval settings"
        description={description}
        actions={
          dirty ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[var(--coral-600)]">Unsaved changes</span>
              <Button variant="outline" onClick={onDiscard} disabled={pending}>Discard</Button>
              <Button onClick={onSave} disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">All changes saved</span>
          )
        }
      />

      <nav aria-label="Approval settings" className="flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {TABS.map((t) => {
          const current = t.key === tab
          return (
            <Link
              key={t.key}
              href={t.href}
              scroll={false}
              aria-current={current ? "page" : undefined}
              className={cn(
                "-mb-px flex items-center gap-2 border-b-[3px] px-4 py-2.5 text-sm",
                current
                  ? "border-coral font-semibold text-ink dark:text-slate-100"
                  : "border-transparent font-medium text-muted-foreground hover:text-ink dark:hover:text-slate-100"
              )}
            >
              {t.label}
              {unsaved[t.key] && <span className="size-1.5 rounded-full bg-coral" aria-label="Unsaved changes" />}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
