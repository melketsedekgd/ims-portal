import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import type { Enums } from "@/types/database";

import { NOTIFICATION_LABELS } from "./labels";

/**
 * Which notifications become email. "Published" is good news about something
 * the requester already did and can see in the app; it does not need to reach
 * anyone's inbox. The other three are all "someone is waiting on you", which
 * is the only thing worth interrupting a person for.
 */
const EMAIL_TYPES: Enums<"notification_type">[] = [
  "change_request_awaiting_owner",
  "change_request_awaiting_ims",
  "change_request_returned",
];

/**
 * Send whatever the trigger has queued, after the transaction that queued it
 * has committed.
 *
 * Never throws. It is called from after(), so a rejection here surfaces as an
 * unhandled error on a request whose response has already gone out, and the
 * decision it belongs to is already saved. Mail failing is not the decision
 * failing.
 *
 * The admin client is required, not a convenience: claim_pending_emails is
 * granted to service_role alone, because it returns email addresses.
 */
export async function sendPendingEmails(): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { data: claimed, error } = await supabase.rpc("claim_pending_emails", {
      p_types: EMAIL_TYPES,
    });
    if (error || !claimed) return;

    const appUrl = process.env.APP_URL ?? "http://localhost:3000";

    for (const row of claimed) {
      // The label and a link, and nothing else. The notification row holds no
      // document name, number, reason or requester, so there is nothing here
      // that could put an IMS document in front of a mail provider.
      const label = NOTIFICATION_LABELS[row.type];
      const result = await sendEmail({
        to: row.email,
        subject: label,
        text: `${label}\n\n${appUrl}${row.link}\n`,
      });

      if (!result.ok) {
        await supabase
          .from("notifications")
          .update({ email_error: result.error })
          .eq("id", row.id);
      }
    }
  } catch {
    // Deliberately swallowed; see above.
  }
}
