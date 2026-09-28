import type { Enums } from "@/types/database";
import type { WorkflowStatus } from "@/types/workflow";

export const FREQUENCY_LABEL: Record<Enums<"period_type">, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  semi_annual: "Semi-annual",
  annual: "Annual",
};

export type KpiStatus = "Achieved" | "Deviated" | "Pending" | "Not Measured";

/**
 * A status as an export file words it. Here rather than in export.ts: a
 * "use server" file can export only its actions, and the shared-item
 * table reads these back to pick each status's chip.
 */
export const KPI_STATUS_EXPORT_LABEL: Record<KpiStatus, string> = {
  Achieved: "On target",
  Deviated: "Below target",
  "Not Measured": "N/A",
  Pending: "Not entered",
};

/**
 * A KPI as the tracking table renders it. Moved here from the deleted
 * components/forms/KpiForm.tsx; the workflow and custom-field members are
 * still referenced by mockData for the approvals page.
 */
export interface KpiFormData {
  id?: string;
  period: string;
  workflowStatus?: WorkflowStatus;
  currentStepIndex?: number;
  processName: string;
  name: string;
  target: string;
  dataSource?: string;
  analysisFrequency?: string;
  analysisMethodology?: string;
  responsibility?: string;
  actual?: string;
  achievementPercentage?: string;
  evidence?: string;
  status: KpiStatus;
  justification?: string;
  customFields?: { id: string; name: string; value: string }[];
}
