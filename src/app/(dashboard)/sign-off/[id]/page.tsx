import { redirect } from "next/navigation"

import { getSignoffDetail } from "@/features/signoff/queries"
import { getCurrentUser } from "@/features/auth/queries"
import { isAdmin } from "@/lib/permissions"

/**
 * Kept only so the notification links written since batch 1 keep working.
 *
 * Sign-off is a state of the quarter and lives in the dashboard header now,
 * so this route renders nothing — it resolves the sign-off to its quarter and
 * sends the reader there. A row RLS hides is indistinguishable from one that
 * never existed, and both mean the same thing here: go to the dashboard.
 *
 * For an IMS admin the quarter alone is not enough: their dashboard shows one
 * department at a time and defaults to IMS's own, which is never the one a
 * sign-off notification is about. The department goes in the URL with it.
 * Everyone else has exactly one dashboard, and ?dept is ignored for them.
 */
export default async function SignOffRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [signoff, user] = await Promise.all([getSignoffDetail(id), getCurrentUser()])

  if (!signoff) redirect("/department")

  const query = new URLSearchParams({
    year: String(signoff.periodYear),
    quarter: signoff.periodLabel,
  })
  if (isAdmin(user)) query.set("dept", signoff.departmentCode)

  redirect(`/department?${query.toString()}`)
}
