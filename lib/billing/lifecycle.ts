import "server-only";

// Offsets for the lapse lifecycle. All measured from lifecycle.lapsedAt (T0),
// except PRE_EXPIRY_WARN_DAYS which counts down to an upcoming expiry.
export const PRE_EXPIRY_WARN_DAYS = 7;
export const REMIND_1_DAYS = 30;
export const REMIND_2_DAYS = 51;
export const WIPE_DAYS = 58;

const DAY_MS = 24 * 60 * 60 * 1000;

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

// Dot-path $set fragment that clears every lapse-lifecycle timestamp. Used
// whenever a workspace becomes entitled again (webhook resubscribe/resume) —
// fresh start, a previously-wiped workspace still has its draft to re-publish.
export function lifecycleResetFields(): Record<string, null> {
  return {
    "lifecycle.lapsedAt": null,
    "lifecycle.warned7dAt": null,
    "lifecycle.expiredNotifiedAt": null,
    "lifecycle.remind1moAt": null,
    "lifecycle.remind7wkAt": null,
    "lifecycle.wipedAt": null,
  };
}
