import "server-only";
import { Types } from "mongoose";
import { Client, Booking } from "@/lib/db/models";
import type { ClientDoc } from "@/lib/db/models/Client";

type WorkspaceId = Types.ObjectId;

export type ListClientsParams = {
  workspaceId: WorkspaceId;
  q?: string;           // searches name + email (case-insensitive, regex-safe)
  source?: string;      // exact match
  tags?: string[];      // $all match (client must have ALL listed tags)
  includeInactive?: boolean;  // default: active only (isActive: true)
  page?: number;        // 1-indexed, default 1
  limit?: number;       // 25 | 50 | 100, default 25
};

// Booking metrics are derived at read time rather than denormalized onto the
// Client doc — the booking write paths (create / import / patch) do not
// maintain Client.bookingsCount or Client.lastBookingAt, so deriving avoids
// drift. The output uses these derived values, falling back to the persisted
// fields only as a safety net (e.g. legacy seed data).
type ClientListItem = ClientDoc & {
  bookingsCount: number;
  lastBookingAt: Date | null;
};

export async function listClients(
  params: ListClientsParams
): Promise<{ items: ClientListItem[]; total: number }> {
  const { workspaceId, q, source, tags, includeInactive, page = 1, limit = 25 } = params;
  const filter: Record<string, unknown> = { workspaceId };

  if (!includeInactive) {
    filter.isActive = true;
  }

  if (q && q.trim()) {
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [{ name: rx }, { email: rx }];
  }

  if (source) {
    filter.source = source;
  }

  if (tags && tags.length > 0) {
    filter.tags = { $all: tags };
  }

  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    Client.find(filter).sort({ name: 1 }).skip(skip).limit(limit).lean(),
    Client.countDocuments(filter),
  ]);

  if (items.length === 0) return { items: [], total };

  // One aggregation over the visible page to attach { count, lastStart } per
  // client. Bounded by `limit` so the worst case is ~100 client IDs in $in.
  const clientIds = items.map((c) => c._id);
  const stats = await Booking.aggregate<{
    _id: Types.ObjectId;
    count: number;
    lastStart: Date | null;
  }>([
    { $match: { workspaceId, clientId: { $in: clientIds } } },
    {
      $group: {
        _id: "$clientId",
        count: { $sum: 1 },
        lastStart: { $max: "$firstSessionStart" },
      },
    },
  ]);

  const statsById = new Map(stats.map((s) => [String(s._id), s]));
  const merged: ClientListItem[] = items.map((c) => {
    const s = statsById.get(String(c._id));
    return {
      ...c,
      bookingsCount: s?.count ?? 0,
      lastBookingAt: s?.lastStart ?? null,
    };
  });

  return { items: merged, total };
}

export async function getWorkspaceTags(workspaceId: WorkspaceId): Promise<string[]> {
  const result = await Client.distinct("tags", { workspaceId, isActive: true });
  return result.filter((t): t is string => typeof t === "string").sort();
}

export type ClientBookingRow = {
  id: string;
  title: string;
  status: string;
  firstSessionStart: Date;
  lastSessionEnd: Date;
  total: number;
  currency: string;
};

export async function getClientBookings(
  workspaceId: WorkspaceId,
  clientId: WorkspaceId
): Promise<ClientBookingRow[]> {
  const bookings = await Booking.find({ workspaceId, clientId })
    .sort({ firstSessionStart: -1 })
    .limit(50)
    .lean();

  return bookings.map((b) => ({
    id: String(b._id),
    title: b.title,
    status: b.status,
    firstSessionStart: b.firstSessionStart,
    lastSessionEnd: b.lastSessionEnd,
    total: b.amount?.total ?? 0,
    currency: b.amount?.currency ?? "PHP",
  }));
}
