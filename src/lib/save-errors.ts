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
