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
  change_request_published: "Your document change was approved and published",

  quarter_submitted: "A department quarter is waiting for your review",
  quarter_returned: "Your department quarter was returned",
  quarter_approved: "A department quarter is waiting to be received by IMS",
  quarter_received: "Your department quarter was received by IMS",

  items_shared: "Someone shared items with you",
}
