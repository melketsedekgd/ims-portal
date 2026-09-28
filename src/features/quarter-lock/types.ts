import type { Enums } from "@/types/database";

/**
 * Whether a department's quarter still takes writes, as the page should
 * show it. Mirrors guard_quarter_lock() and guard_evidence_lock():
 *
 *   signed_off  a sign-off in submitted/approved/received. Binds everyone,
 *               IMS admins included.
 *   closed      reporting_periods.status = 'closed'. Binds everyone but IMS
 *               admins.
 *
 * The database is the authority; this only decides what is rendered.
 * Client-safe on purpose — no server imports here.
 */
export type QuarterLock = {
  locked: boolean;
  reason: "signed_off" | "closed" | null;
  /** The sign-off status, when reason is signed_off. */
  status?: Enums<"signoff_status">;
};

export const UNLOCKED: QuarterLock = { locked: false, reason: null };

/** "Q1 2026 was received by IMS", or null for an open quarter. */
export function quarterLockMessage(period: string, lock: QuarterLock): string | null {
  if (!lock.locked) return null;
  if (lock.reason === "signed_off") {
    return lock.status === "received" ? `${period} was received by IMS` : `${period} is ${lock.status}`;
  }
  return `${period} is closed`;
}
