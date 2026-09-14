import type { WorkflowStatus } from "@/types/workflow";

export type KpiStatus = "Achieved" | "Deviated" | "Pending" | "Not Measured";

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
