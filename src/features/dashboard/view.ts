/**
 * Which dashboard the URL is asking for, and what URL asks for each one.
 *
 * Pure and free of React and of the Supabase client, so the page (server),
 * the selector (client) and a plain node script can all use the same
 * resolution. The dropdown's selection comes out of the same call that
 * decides what the page renders, which is what keeps the two from ever
 * disagreeing — they are one answer, not two that have to be kept in step.
 */

/** The value the "All departments" option carries in the URL and the select. */
export const ALL_DEPARTMENTS = "all";

/** IMS's own department. The view an IMS user lands on with no params. */
export const OWN_CODE = "IMS";

export type DashboardView =
  | { kind: "tracker"; selection: string }
  | { kind: "department"; code: string; selection: string };

/**
 * The URL holds exactly one of ?view=all and ?dept=<code>, and neither for
 * IMS's own dashboard. A hand-typed URL can still hold both, so the order
 * here is the tie-break and it is fixed: view first, then dept, then the
 * default. Anything else would make ?view=all&dept=SRD show SRD, which is
 * not what the URL most specifically asks for.
 *
 * An unknown code falls back to IMS's own rather than erroring or widening
 * to everything: the selector cannot produce one, so it means a hand-edited
 * URL, and the default view is the least surprising place to land.
 */
export function resolveDashboardView(
  params: { view?: string; dept?: string },
  knownCodes: readonly string[]
): DashboardView {
  if (params.view === ALL_DEPARTMENTS) {
    return { kind: "tracker", selection: ALL_DEPARTMENTS };
  }

  const code =
    params.dept && knownCodes.includes(params.dept) ? params.dept : OWN_CODE;

  return { kind: "department", code, selection: code };
}

/**
 * The query string for a new selection, keeping everything else in the URL.
 *
 * Only view and dept belong to the selector; the quarter and year belong to
 * the period picker and have to survive a view change, the same way the
 * view survives a quarter change.
 *
 * Both are always removed before one is set, so the URL can never hold two
 * answers at once. IMS's own dashboard sets neither: it is the default, and
 * a default that writes itself into the URL is one more state to keep
 * consistent for nothing.
 */
export function nextViewParams(
  current: URLSearchParams,
  choice: string
): URLSearchParams {
  const params = new URLSearchParams(current.toString());

  params.delete("view");
  params.delete("dept");

  if (choice === ALL_DEPARTMENTS) params.set("view", ALL_DEPARTMENTS);
  else if (choice !== OWN_CODE) params.set("dept", choice);

  return params;
}
