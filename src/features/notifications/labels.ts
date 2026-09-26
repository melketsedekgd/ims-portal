import type { Enums } from "@/types/database"

/**
 * One line per type, and nothing else. A notification row holds no document
 * name, requester or reason, so there is nothing here to interpolate — which
 * is the point: the email pass renders from this same map, and a subject line
 * built from it cannot leak an IMS document into a mail provider.
 */
export const NOTIFICATION_LABELS: Record<Enums<"notification_type">, string> = {
  change_request_awaiting_owner: "A document change is waiting for your review",
  change_request_awaiting_ims: "A document change is waiting for IMS review",
  change_request_returned: "Your document change was returned",
  change_request_published: "Your document was published",
  change_request_awaiting_coordinator: "A document change is waiting for coordinator review",
  change_request_awaiting_extra_review: "A document change from another department needs your review",
  change_request_awaiting_draft: "Your document change needs a draft",
  change_request_draft_returned: "Your draft was returned",
  change_request_awaiting_final: "A document change is waiting for final approval",
  change_request_awaiting_document_control: "A document change is waiting for document control",
  change_request_retired: "Your document was retired",

  quarter_submitted: "A department quarter is waiting for your review",
  quarter_returned: "Your department quarter was returned",
  quarter_approved: "A department quarter is waiting to be received by IMS",
  quarter_received: "Your department quarter was received by IMS",

  items_shared: "Someone shared items with you",
}
