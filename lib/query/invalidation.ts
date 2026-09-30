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
        ...(inquiryId ? [q.inquiries(), q.inquiry(inquiryId)] : []),
      ];
    }
    case "inquiry.created":
      return [q.inquiries(), q.calendar(), q.dashboard()];
    case "inquiry.updated":
      return [
        q.inquiries(),
        q.inquiry(event.inquiryId),
        q.calendar(),
        q.dashboard(),
        ...(event.bookingId ? [q.booking(event.bookingId), q.bookings(), q.client(), q.shifts()] : []),
      ];
    case "client.created":
    case "client.updated":
      // Client names render inside booking views, so the whole booking domain is stale.
      return [q.clients(), q.client(event.clientId), q.bookings(), q.booking(), q.calendar(), q.inquiries()];
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
      const inquiryId = event.type === "booking.updated" ? event.inquiryId : undefined;
      return ["/bookings", "/dashboard", "/clients", ...(inquiryId ? ["/inquiries"] : [])];
    }
    case "inquiry.created":
      return ["/inquiries", "/dashboard"];
    case "inquiry.updated":
      return ["/inquiries", "/dashboard", ...(event.bookingId ? ["/bookings"] : [])];
    case "client.created":
    case "client.updated":
      return ["/clients", "/bookings", "/inquiries"];
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

function fingerprint(event: DataEvent): string {
  const { type, ...ids } = event as { type: string } & Record<string, unknown>;
  return `${type}|${Object.keys(ids)
    .sort()
    .map((k) => `${k}=${ids[k] ?? ""}`)
    .join("&")}`;
}

/** Record a locally-invalidated event so its socket echo can be skipped for ~2 s. */
export function markLocalEvent(event: DataEvent): void {
  const now = Date.now();
  for (const [fp, at] of recentLocal) if (now - at > ECHO_WINDOW_MS) recentLocal.delete(fp);
  recentLocal.set(fingerprint(event), now);
}

/**
 * True when `event` matches a locally-marked event from the last ~2 s. One-shot:
 * the first match consumes the mark so a teammate's identical event still invalidates.
 */
export function isLocalEcho(event: DataEvent): boolean {
  const fp = fingerprint(event);
  const at = recentLocal.get(fp);
  if (at === undefined) return false;
  recentLocal.delete(fp);
  return Date.now() - at <= ECHO_WINDOW_MS;
}

/** Invalidate (and refetch active) queries made stale by `event`. */
export function invalidateFor(queryClient: QueryClient, workspaceId: string, event: DataEvent): Promise<void[]> {
  return Promise.all(keysForEvent(workspaceId, event).map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
