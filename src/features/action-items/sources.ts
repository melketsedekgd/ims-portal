// What an action belongs to, as v_action_sources resolves it. Plain types
// and helpers with no server imports, so client components can use them.

export type ActionItemType = "risk" | "kpi" | "objective" | "document";

export const ITEM_TYPE_LABEL: Record<ActionItemType, string> = {
  risk: "Risk",
  kpi: "KPI",
  objective: "Objective",
  document: "Document change",
};

export type ActionSourceInfo = {
  actionId: string;
  /** null only for an action pointing at another action. */
  itemType: ActionItemType | null;
  /** The risk / kpi / objective / document_change_request id; null when the source no longer resolves. */
  itemId: string | null;
  itemLabel: string | null;
  /** The change request's document — change requests are listed on their document's page. */
  documentId: string | null;
  departmentId: string;
  /** null when the source is not a quarterly row. */
  reportingPeriodId: string | null;
  periodYear: number | null;
  /** As stored: "Q1" … "Q4" for quarterly periods. */
  periodLabel: string | null;
  /** The report's reason for deviation (or KPI remark), exactly as stored. */
  contextReason: string | null;
  /** The report's follow-up text, exactly as stored. */
  contextFollowup: string | null;
};

/** "Q1 2026", or null when the source has no period. */
export function actionSourcePeriod(row: Pick<ActionSourceInfo, "periodYear" | "periodLabel">): string | null {
  if (row.periodYear === null || !row.periodLabel) return null;
  return `${row.periodLabel} ${row.periodYear}`;
}

/**
 * The page the related item lives on: the risk, KPI or objective detail
 * page, carrying ?year=&quarter= when the source is a quarterly row, or
 * the document page a change request is listed on. null when the source
 * does not resolve to anything this user can open.
 *
 * Only a Q1–Q4 label goes into ?quarter= — the pages read nothing else,
 * and a monthly period's "Jan" would name a quarter that doesn't exist.
 */
export function actionSourceHref(
  row: Pick<ActionSourceInfo, "itemType" | "itemId" | "documentId" | "periodYear" | "periodLabel">
): string | null {
  if (!row.itemId) return null;

  let path: string;
  switch (row.itemType) {
    case "risk":
      path = `/department/risks/${row.itemId}`;
      break;
    case "kpi":
      path = `/department/kpis/${row.itemId}`;
      break;
    case "objective":
      path = `/department/objectives/${row.itemId}`;
      break;
    case "document":
      return row.documentId ? `/department/documents/${row.documentId}` : null;
    default:
      return null;
  }

  if (row.periodYear !== null && row.periodLabel && /^Q[1-4]$/.test(row.periodLabel)) {
    const params = new URLSearchParams({ year: String(row.periodYear), quarter: row.periodLabel });
    return `${path}?${params}`;
  }
  return path;
}
