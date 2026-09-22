import { redirect } from "next/navigation"

import { getSignoffDetail } from "@/features/signoff/queries"

/**
 * Kept only so the notification links written since batch 1 keep working.
 *
 * Sign-off is a state of the quarter and lives in the dashboard header now,
 * so this route renders nothing — it resolves the sign-off to its quarter and
 * sends the reader there. A row RLS hides is indistinguishable from one that
 * never existed, and both mean the same thing here: go to the dashboard.
 */
export default async function SignOffRedirect({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const signoff = await getSignoffDetail(id)

  if (!signoff) redirect("/department")
  redirect(`/department?year=${signoff.periodYear}&quarter=${signoff.periodLabel}`)
}
