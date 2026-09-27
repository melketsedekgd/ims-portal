import DecisionPanel from "@/features/documents/components/DecisionPanel"
import { PublishForm, RetireButton } from "@/features/documents/components/DocumentControlPanel"
import { STATUS_STAGE } from "@/features/documents/components/ChangeRequestStatusBadge"
import type { ChangeRequestItem } from "@/features/documents/queries"

export function NeedsActionItem({ request }: { request: ChangeRequestItem }) {
  if (request.status === "pending_document_control") {
    return request.requestType === "deletion" ? (
      <RetireButton request={request} />
    ) : (
      <PublishForm request={request} />
    )
  }
  const stage = STATUS_STAGE[request.status]
  // document_control is decided by PublishForm/RetireButton above, never a DecisionPanel.
  if (!stage || stage === "document_control") return null
  return <DecisionPanel request={request} stage={stage} />
}
