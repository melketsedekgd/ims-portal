"use client"

import { useCallback, useState } from "react"
import type { WorkflowSettingsItem } from "@/features/documents/queries"
import type { ExtraReviewerRole } from "@/features/documents/workflow"
import ApprovalSettingsHeader, { type SettingsTab } from "./ApprovalSettingsHeader"
import DocumentSettings from "./DocumentSettings"

type Department = { id: string; name: string; code: string }

/**
 * The Approval settings page: one tab per kind of approval, the open one
 * from ?tab=. Both tabs stay mounted and the other is hidden, so switching
 * tabs keeps the unsaved changes on each until they are saved or discarded.
 */
export default function ApprovalSettings({
  tab,
  types,
  departments,
  holders,
}: {
  tab: SettingsTab
  types: WorkflowSettingsItem[]
  departments: Department[]
  holders: { departmentId: string; role: ExtraReviewerRole }[]
}) {
  const [unsaved, setUnsaved] = useState<Record<SettingsTab, boolean>>({ documents: false, signoff: false })
  const onDocumentsDirty = useCallback((d: boolean) => setUnsaved((u) => ({ ...u, documents: d })), [])

  return (
    <>
      <div hidden={tab !== "documents"}>
        <DocumentSettings
          types={types}
          departments={departments}
          holders={holders}
          unsaved={unsaved}
          onDirtyChange={onDocumentsDirty}
        />
      </div>
      <div hidden={tab !== "signoff"}>
        <ApprovalSettingsHeader
          tab="signoff"
          description="Choose which steps each approval goes through. Changes apply from the next submission — a quarter already submitted finishes on the settings it started with."
          unsaved={unsaved}
          dirty={false}
          pending={false}
          onSave={() => {}}
          onDiscard={() => {}}
        />
      </div>
    </>
  )
}
