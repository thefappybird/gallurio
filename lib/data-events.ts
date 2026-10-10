// Isomorphic (no server imports): shared by the server emitter and the client
// cache-invalidation map. Payloads carry ONLY a type and opaque ids - never
// names, amounts or other entity data (staff team-scope must not leak).

export const DATA_CHANGED_EVENT = "data:changed" as const;

export type DataEvent =
  | { type: "booking.created"; bookingId: string; clientId?: string | null }
  | {
      type: "booking.updated";
      bookingId: string;
      clientId?: string | null;
      inquiryId?: string | null;
    }
  | { type: "bookings.imported" }
  // Sent instead of a booking event to staff who cannot see that booking: clients
  // list shows workspace-wide booking counts/totals, so they still refetch clients.
  | { type: "client.statsChanged"; clientId?: string | null }
  | { type: "inquiry.created"; inquiryId: string }
  | { type: "inquiry.updated"; inquiryId: string; bookingId?: string | null }
  | { type: "client.created" | "client.updated"; clientId: string }
  | { type: "team.updated"; teamId?: string | null }
  | { type: "workspace.updated" };

export type DataChangedPayload = {
  workspaceId: string;
  event: DataEvent;
  at: number;
};
