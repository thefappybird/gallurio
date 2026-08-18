import "server-only";
import { Types } from "mongoose";
import { Client, Booking, Transaction } from "@/lib/db/models";
import type { ClientDoc } from "@/lib/db/models/Client";
import { getConvertedClientTotals } from "@/lib/pricing/clientTotals";
import type { RateMap } from "@/lib/pricing/currencyConverter";

type WorkspaceId = Types.ObjectId;

export type ListClientsParams = {
  workspaceId: WorkspaceId;
  q?: string;           // searches name + email (case-insensitive, regex-safe)
  source?: string;      // exact match
  tags?: string[];      // $all match (client must have ALL listed tags)
  includeInactive?: boolean;  // default: active only (isActive: true)
  page?: number;        // 1-indexed, default 1
  limit?: number;       // 25 | 50 | 100, default 25
  // Workspace rate map. Supplied when the caller renders totalSpent labelled
  // with the workspace currency — see the note on ClientListItem. Accepts a
  // pending promise so the caller can kick off getWorkspaceRateMap alongside
  // its other queries instead of awaiting it first — it's only awaited here,
  // right before it's needed.
  rates?: RateMap | Promise<RateMap>;
};

// Booking metrics are derived at read time rather than denormalized onto the
// Client doc — the booking write paths (create / import / patch) do not
// maintain Client.bookingsCount or Client.lastBookingAt, so deriving avoids
// drift. The output uses these derived values, falling back to the persisted
// fields only as a safety net (e.g. legacy seed data).
export type ClientListItem = ClientDoc & {
  bookingsCount: number;
  lastBookingAt: Date | null;
};

export async function listClients(
  params: ListClientsParams
): Promise<{ items: ClientListItem[]; total: number }> {
  const { workspaceId, q, source, tags, includeInactive, page = 1, limit = 25, rates = {} } = params;
  const filter: Record<string, unknown> = { workspaceId };

  // Collect into $and so multiple $or groups (active-state, search) don't
  // collide on a single $or key. Skipped entirely if no conditions apply.
  const and: Record<string, unknown>[] = [];

  if (!includeInactive) {
    // Treat docs missing `isActive` as active — the field was added after
    // some clients were already in the collection, and a strict
    // `isActive: true` would silently hide them from the default view.
    and.push({ $or: [{ isActive: true }, { isActive: { $exists: false } }] });
  }

  if (q && q.trim()) {
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    and.push({ $or: [{ name: rx }, { email: rx }] });
  }

  if (and.length > 0) {
    filter.$and = and;
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
  // Runs alongside the rate-map resolution + converted-totals lookup — both
  // only need clientIds, not each other's result.
  const clientIds = items.map((c) => c._id);
  const [stats, convertedTotals] = await Promise.all([
    Booking.aggregate<{
      _id: Types.ObjectId;
      count: number;
      lastStart: Date | null;
    }>([
      // Exclude draft bookings — an unapproved inquiry must not inflate a client's
      // booking count or "last booking" date in the clients list.
      { $match: { workspaceId, status: { $ne: "draft" }, clientId: { $in: clientIds } } },
      {
        $group: {
          _id: "$clientId",
          count: { $sum: 1 },
          lastStart: { $max: "$firstSessionStart" },
        },
      },
    ]),
    Promise.resolve(rates).then((r) => getConvertedClientTotals(workspaceId, clientIds, r)),
  ]);

  const statsById = new Map(stats.map((s) => [String(s._id), s]));
  const merged: ClientListItem[] = items.map((c) => {
    const s = statsById.get(String(c._id));
    return {
      ...c,
      // With a rate map, the ledger is authoritative for clients it covers.
      // A client with no Transaction rows predates the ledger (legacy seed
      // data / pre-multi-currency), so fall back to the stored (unconverted)
      // totalSpent rather than rendering 0 for real money.
      totalSpent: convertedTotals ? (convertedTotals.get(String(c._id)) ?? c.totalSpent) : c.totalSpent,
      bookingsCount: s?.count ?? 0,
      lastBookingAt: s?.lastStart ?? null,
    };
  });

  return { items: merged, total };
}

export async function getClientById(
  workspaceId: WorkspaceId,
  clientId: string,
  rates: RateMap | Promise<RateMap> = {}
): Promise<ClientListItem | null> {
  if (!Types.ObjectId.isValid(clientId)) return null;

  const c = await Client.findOne({
    _id: new Types.ObjectId(clientId),
    workspaceId,
  }).lean();

  if (!c) return null;

  const [stats, convertedTotals] = await Promise.all([
    Booking.aggregate<{
      _id: Types.ObjectId;
      count: number;
      lastStart: Date | null;
    }>([
      { $match: { workspaceId, clientId: c._id } },
      {
        $group: {
          _id: "$clientId",
          count: { $sum: 1 },
          lastStart: { $max: "$firstSessionStart" },
        },
      },
    ]),
    Promise.resolve(rates).then((r) => getConvertedClientTotals(workspaceId, [c._id], r)),
  ]);

  return {
    ...c,
    // Unconverted fallback for pre-ledger clients — see the note in listClients.
    totalSpent: convertedTotals ? (convertedTotals.get(String(c._id)) ?? c.totalSpent) : c.totalSpent,
    bookingsCount: stats[0]?.count ?? 0,
    lastBookingAt: stats[0]?.lastStart ?? null,
  };
}

export async function getWorkspaceTags(workspaceId: WorkspaceId): Promise<string[]> {
  // Mirror listClients' default-active rule: pre-`isActive` documents should
  // still contribute their tags to the filter dropdown.
  const result = await Client.distinct("tags", {
    workspaceId,
    $or: [{ isActive: true }, { isActive: { $exists: false } }],
  });
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

export type ClientPaymentRow = {
  id: string;
  bookingTitle: string;
  paymentTitle: string;
  amount: number;
  currency: string;
  method: "cash" | "card" | "remit" | "other";
  paidAt: Date | null;
};

export async function getClientPayments(
  workspaceId: WorkspaceId,
  clientId: WorkspaceId,
  page = 1,
  limit = 20
): Promise<{ items: ClientPaymentRow[]; hasMore: boolean }> {
  const skip = (page - 1) * limit;
  const transactions = await Transaction.find({
    workspaceId,
    clientId,
    type: { $in: ["deposit", "balance"] },
  })
    .sort({ paidAt: -1, _id: -1 })
    .skip(skip)
    .limit(limit + 1)
    .lean();
  const visible = transactions.slice(0, limit);
  const bookingIds = [...new Set(visible.map((row) => String(row.bookingId)).filter(Boolean))];
  const bookings = bookingIds.length
    ? await Booking.find({ workspaceId, _id: { $in: bookingIds } }).select({ _id: 1, title: 1 }).lean()
    : [];
  const titles = new Map(bookings.map((booking) => [String(booking._id), booking.title]));
  return {
    items: visible.map((row) => ({
      id: String(row._id),
      bookingTitle: titles.get(String(row.bookingId)) ?? "Booking",
      paymentTitle: row.notes || (row.type === "deposit" ? "Deposit" : "Payment"),
      amount: row.amount,
      currency: row.currency ?? "PHP",
      method: (row.method === "card" || row.method === "remit" || row.method === "cash" ? row.method : "other"),
      paidAt: row.paidAt ?? null,
    })),
    hasMore: transactions.length > limit,
  };
}

export async function getClientBookings(
  workspaceId: WorkspaceId,
  clientId: WorkspaceId
): Promise<ClientBookingRow[]> {
  const bookings = await Booking.find({ workspaceId, clientId, status: { $ne: "draft" } })
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
