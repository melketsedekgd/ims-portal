export type WorkflowStatus = "Draft" | "Pending Approval" | "Rejected" | "Published";

export interface WorkflowTemplate {
  id: string;
  departmentName: string;
  entityType: "Objective" | "KPI";
  steps: string[]; // e.g., ["Writer", "QMS Coordinator", "IMS Manager", "VP", "Published"]
}

export interface ApprovalLog {
  id: string;
  itemId: string; // The ID of the Objective or KPI
  actorName: string; // E.g., "John Doe (VP)"
  action: "Submitted" | "Approved" | "Rejected";
  comment?: string; // Mandatory on rejection
  createdAt: string; // ISO timestamp
}
