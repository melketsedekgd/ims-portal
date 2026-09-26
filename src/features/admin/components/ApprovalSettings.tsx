"use client"

import { useCallback, useState } from "react"
import type { WorkflowSettingsItem } from "@/features/documents/queries"
import type { ExtraReviewerRole } from "@/features/documents/workflow"
import type { SignoffSettingsItem } from "@/features/signoff/queries"
import type { SettingsTab } from "./ApprovalSettingsHeader"
import DocumentSettings from "./DocumentSettings"
import SignoffSettings from "./SignoffSettings"

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
  signoff,
}: {
  tab: SettingsTab
  types: WorkflowSettingsItem[]
  departments: Department[]
  holders: { departmentId: string; role: ExtraReviewerRole }[]
  signoff: SignoffSettingsItem[]
}) {
  const [unsaved, setUnsaved] = useState<Record<SettingsTab, boolean>>({ documents: false, signoff: false })
  const onDocumentsDirty = useCallback((d: boolean) => setUnsaved((u) => ({ ...u, documents: d })), [])
  const onSignoffDirty = useCallback((d: boolean) => setUnsaved((u) => ({ ...u, signoff: d })), [])

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
        <SignoffSettings departments={signoff} unsaved={unsaved} onDirtyChange={onSignoffDirty} />
      </div>
    </>
  )
}
