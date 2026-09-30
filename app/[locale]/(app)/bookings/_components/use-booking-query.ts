"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppWorkspaceId } from "@/components/app/app-query-provider";
import { EDITABLE_QUERY_OPTIONS, queryKeys } from "@/lib/query/keys";
import type { ActivityEntry } from "./activity-types";

export type BookingActivityBlock = {
  entries: ActivityEntry[];
  total: number;
  page: number;
  pageSize: number;
  actorNames: Record<string, string>;
};

/** Server said the booking does not exist (or is not in this workspace). */
export class BookingNotFoundError extends Error {
  constructor() {
    super("not_found");
    this.name = "BookingNotFoundError";
  }
}

async function fetchBooking<T>(id: string): Promise<T & { activity?: BookingActivityBlock }> {
  const res = await fetch(`/api/bookings/${encodeURIComponent(id)}?include=activity`);
  if (res.status === 404) throw new BookingNotFoundError();
  if (!res.ok) throw new Error(`booking_load_failed_${res.status}`);
  return res.json();
}

/**
 * ONE booking query shared by the detail modal and the edit wizard (same key,
 * so detail -> "Edit all" is served from cache). Never refetches on focus:
 * callers seed local edit state from it.
 */
export function useBookingQuery<T>(id: string, enabled = true) {
  const ws = useAppWorkspaceId();
  return useQuery({
    queryKey: queryKeys(ws).booking(id),
    queryFn: () => fetchBooking<T>(id),
    enabled,
    retry: (count, err) => !(err instanceof BookingNotFoundError) && count < 1,
    ...EDITABLE_QUERY_OPTIONS,
  });
}
