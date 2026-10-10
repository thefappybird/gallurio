import type { QueryClient, QueryKey } from "@tanstack/react-query";
import type { DataEvent } from "@/lib/data-events";
import { queryKeys } from "./keys";

/** Prefix keys made stale by `event`. Single source of truth. */
export function keysForEvent(workspaceId: string, event: DataEvent): QueryKey[] {
  const q = queryKeys(workspaceId);
  switch (event.type) {
    case "booking.created":
    case "booking.updated":
    case "bookings.imported": {
      const id = "bookingId" in event ? event.bookingId : undefined;
      const inquiryId = event.type === "booking.updated" ? event.inquiryId : undefined;
      return [
        ...(id ? [q.booking(id), q.bookingActivity(id)] : []),
        // Import can update existing bookings, so their whole detail domains are stale.
        ...(event.type === "bookings.imported" ? [q.booking(), q.bookingActivity()] : []),
        q.bookings(),
        q.calendar(),
        q.dashboard(),
        // Whole domain: a reassignment sends only the new clientId; old client is stale too.
        q.clients(),
        // Client-detail modal queries (bookings/payments), incl. the OLD client on reassignment.
        q.client(),
        // Conflict previews: a just-created/moved booking must show up in them.
        q.shifts(),
        // Member history lists these writes.
        q.memberActivity(),
        ...(inquiryId ? [q.inquiries(), q.inquiry(inquiryId)] : []),
      ];
    }
    case "inquiry.created":
      return [q.inquiries(), q.calendar(), q.dashboard(), q.memberActivity()];
    case "inquiry.updated":
      return [
        q.inquiries(),
        q.inquiry(event.inquiryId),
        q.calendar(),
        q.dashboard(),
        q.memberActivity(),
        ...(event.bookingId ? [q.booking(event.bookingId), q.bookings(), q.client(), q.shifts()] : []),
      ];
    case "client.created":
    case "client.updated":
      // Client names render inside booking views, so the whole booking domain is stale.
      // Dashboard's top-clients card shows name/totalSpent; member history lists client writes.
      return [
        q.clients(),
        q.client(event.clientId),
        q.bookings(),
        q.booking(),
        q.calendar(),
        q.inquiries(),
        q.dashboard(),
        q.memberActivity(),
      ];
    case "client.statsChanged":
      return [q.clients(), q.client()];
    case "team.updated":
      return [q.teams(), q.memberActivity(), q.calendar(), q.bookings(), q.dashboard()];
    case "workspace.updated":
      return [q.root];
  }
}

/** Locale-less path prefixes whose SERVER-rendered data `event` affects. */
export function routesForEvent(event: DataEvent): string[] {
  switch (event.type) {
    case "booking.created":
    case "booking.updated":
    case "bookings.imported": {
      // /inquiries renders booking candles + conflict flags server-side; /teams renders booking stats.
      return ["/bookings", "/dashboard", "/clients", "/inquiries", "/teams"];
    }
    case "inquiry.created":
      return ["/inquiries", "/dashboard"];
    case "inquiry.updated":
      return ["/inquiries", "/dashboard", ...(event.bookingId ? ["/bookings", "/teams"] : [])];
    case "client.created":
    case "client.updated":
      return ["/clients", "/bookings", "/inquiries", "/dashboard"];
    case "client.statsChanged":
      return ["/clients"];
    case "team.updated":
      return ["/teams", "/bookings", "/inquiries", "/dashboard"];
    case "workspace.updated":
      // CRM routes with workspace-derived server data. Not /portfolio (editor) or /settings
      // (actor's action already revalidates; teammate's form must not refresh mid-edit).
      return ["/dashboard", "/bookings", "/inquiries", "/clients", "/teams", "/notifications"];
  }
}

const ECHO_WINDOW_MS = 2_000;
const recentLocal = new Map<string, number>();
// Non-echo arrivals. The server emits before slow awaited work, so the actor's own
// echo can land BEFORE markLocalEvent runs; remembering remote arrivals lets a late
// mark see that the echo already came instead of swallowing a teammate's event.
const recentRemote = new Map<string, number>();

function fingerprint(event: DataEvent): string {
  const { type, ...ids } = event as { type: string } & Record<string, unknown>;
  return `${type}|${Object.keys(ids)
    .sort()
    .map((k) => `${k}=${ids[k] ?? ""}`)
    .join("&")}`;
}

function prune(map: Map<string, number>, now: number): void {
  for (const [fp, at] of map) if (now - at > ECHO_WINDOW_MS) map.delete(fp);
}

/**
 * Record a locally-invalidated event so its socket echo can be skipped for ~2 s.
 * No mark is set when the same event already arrived remotely within the window:
 * that arrival was the echo, so a mark would only swallow a teammate's next event.
 */
export function markLocalEvent(event: DataEvent): void {
  const now = Date.now();
  prune(recentLocal, now);
  prune(recentRemote, now);
  const fp = fingerprint(event);
  if (recentRemote.has(fp)) {
    recentRemote.delete(fp);
    return;
  }
  recentLocal.set(fp, now);
}

/**
 * True when `event` matches a locally-marked event from the last ~2 s. One-shot:
 * the first match consumes the mark so a teammate's identical event still invalidates.
 * Non-matching arrivals are remembered (see recentRemote).
 */
export function isLocalEcho(event: DataEvent): boolean {
  const now = Date.now();
  const fp = fingerprint(event);
  const at = recentLocal.get(fp);
  if (at !== undefined) {
    recentLocal.delete(fp);
    if (now - at <= ECHO_WINDOW_MS) return true;
  }
  prune(recentRemote, now);
  recentRemote.set(fp, now);
  return false;
}

/** Invalidate (and refetch active) queries made stale by `event`. */
export function invalidateFor(queryClient: QueryClient, workspaceId: string, event: DataEvent): Promise<void[]> {
  return Promise.all(keysForEvent(workspaceId, event).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
