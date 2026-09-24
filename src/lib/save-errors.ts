/**
 * Why a figure did not save.
 *
 * Two different locks refuse these writes and they fail in different shapes,
 * which was measured rather than assumed:
 *
 *   quarter sign-off  guard_quarter_lock() raises, so the message arrives
 *                     prefixed 'quarter_locked:' whoever the caller is.
 *   closed period     an RLS policy refuses. A PostgREST upsert surfaces that
 *                     as 42501 "new row violates row-level security policy";
 *                     a plain UPDATE reports success having changed 0 rows,
 *                     which is why the callers that use one check the count.
 *
 * Both say "not saved" first. The previous wording left people unsure whether
 * a refused save had gone through.
 */
export function saveErrorMessage(
  error: { code?: string; message: string },
  fallback: string
): string {
  if (error.message.startsWith("quarter_locked")) {
    return "Not saved: this quarter has been submitted for sign-off.";
  }
  if (error.code === "42501") {
    return "Not saved: this period is closed.";
  }
  return fallback;
}

/** What a plain UPDATE that matched nothing means. */
export const NOT_SAVED_CLOSED = "Not saved: this period is closed.";

/**
 * Why a share was not sent. create_share() raises a 'share_' code and
 * writes nothing, so every message says "Not shared".
 */
export function shareErrorMessage(error: { code?: string; message: string }): string {
  const m = error.message;
  if (m.startsWith("share_recipient_not_allowed")) {
    return "Not shared: you can't share with one of the people you picked.";
  }
  if (m.startsWith("share_item_not_visible")) {
    return "Not shared: one of the items is no longer available to you.";
  }
  if (m.includes("between 1 and 200 items")) return "Not shared: pick between 1 and 200 items.";
  if (m.includes("between 1 and 20 recipients")) return "Not shared: pick between 1 and 20 people.";
  if (m.includes("note over 500")) return "Not shared: the note is over 500 characters.";
  if (m.includes("no such quarter")) return "Not shared: that quarter doesn't exist.";
  if (m.startsWith("share_not_signed_in")) return "Your session has ended. Sign in again.";
  if (m.startsWith("share_invalid")) return "Not shared: something in the request wasn't valid.";
  return "Not shared. Try again.";
}
