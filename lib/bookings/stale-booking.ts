/**
 * Client helpers for the optimistic-concurrency token on PATCH /api/bookings/[id].
 * The server answers 409 { error: "stale", booking } when `expectedUpdatedAt`
 * no longer matches; callers swap their baseline for `booking` and surface the
 * `app.bookings.detail.staleConflict` copy.
 */
export class StaleBookingError extends Error {
  readonly booking: unknown;
  constructor(booking: unknown) {
    super("stale");
    this.name = "StaleBookingError";
    this.booking = booking;
  }
}

/** Throws StaleBookingError on 409 stale; leaves the body readable otherwise. */
export async function throwIfStale(res: Response): Promise<void> {
  if (res.status !== 409) return;
  const data = (await res.clone().json().catch(() => null)) as
    | { error?: string; booking?: unknown }
    | null;
  if (data?.error === "stale") throw new StaleBookingError(data.booking ?? null);
}

/** True only when both tokens parse and `remote` is strictly later than `local`. */
export function isNewerUpdatedAt(remote?: string | null, local?: string | null): boolean {
  if (!remote || !local) return false;
  const r = Date.parse(remote);
  const l = Date.parse(local);
  return Number.isFinite(r) && Number.isFinite(l) && r > l;
}
