import type { Enums } from "@/types/database";

/**
 * Display labels for the action enums. Pure, so the list and the dialogs
 * share one wording and never show a raw enum value.
 */
export const ACTION_STATUS_LABEL: Record<Enums<"action_status">, string> = {
  open: "Open",
  in_progress: "In progress",
  blocked: "Blocked",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** actions.priority is a smallint: 1 low … 3 high. */
export const ACTION_PRIORITY_LABEL: Record<string, string> = {
  "1": "Low",
  "2": "Medium",
  "3": "High",
};
