import type { Enums } from "@/types/database";

/**
 * Display labels for the treatment enums. Pure, so the server-rendered risk
 * page and the client dialogs share one wording.
 */
export const TREATMENT_STATUS_LABEL: Record<Enums<"treatment_status">, string> = {
  planned: "Planned",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** The review's verdict on the treatment, as the report's column reads. */
export const EFFECTIVENESS_LABEL: Record<Enums<"treatment_effectiveness">, string> = {
  maintain: "Maintain",
  correction: "Correction",
  corrective_action: "Corrective action",
};
