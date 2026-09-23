import { createClient } from "@/lib/supabase/server";

/* ---------------------------------------------------------------------
 * The department selector
 *
 * ── On the departmentId parameter the dashboard queries now take ──
 *
 * CLAUDE.md's rule stands: never add a department filter to a query in
 * place of RLS. An empty list is a permissions result, and an .eq() that
 * papers over one hides a real bug.
 *
 * The selector's departmentId is a different thing. It narrows a read the
 * reader is already allowed to make, because they asked to look at one
 * department rather than all of the ones they can see. It is never the
 * only thing standing between a reader and someone else's data: every one
 * of these queries still runs under RLS, and an IT contributor who hand-
 * edits ?dept=SRD into the URL gets IT's empty intersection with SRD,
 * which is nothing — not SRD's figures.
 *
 * That is also why it is optional everywhere and passed by exactly one
 * caller. Undefined is the old behaviour, unchanged, which is what the KPI,
 * objective and risk list pages still use.
 * ------------------------------------------------------------------- */

export type DashboardDepartment = {
  id: string;
  code: string;
  name: string;
  takesPartInSignoff: boolean;
};

/**
 * Departments the IMS dashboard can be pointed at, alphabetically by name.
 *
 * Inactive departments are left out. Deletion here is soft — a department
 * that closed keeps its rows so its history still reads — but it is not
 * somewhere anyone is still reporting, and offering it in a live picker
 * invites someone to go looking for this quarter's figures in it.
 *
 * Departments that take no part in sign-off are included: not signing off
 * is not the same as not existing, and IMS itself is one of them.
 */
export async function getSelectableDepartments(): Promise<DashboardDepartment[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("departments")
    .select("id, code, name, takes_part_in_signoff")
    .eq("status", "active")
    .order("name");

  if (error) throw error;

  return (data ?? []).map((d) => ({
    id: d.id,
    code: d.code,
    name: d.name,
    takesPartInSignoff: d.takes_part_in_signoff,
  }));
}
