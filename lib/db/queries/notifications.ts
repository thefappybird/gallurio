/**
 * Tenant-safe notification read helpers.
 *
 * Multi-tenant safety:
 * - `workspaceId` and `recipientWorkosUserId` are ALWAYS supplied from server
 *   context (never from the client). Every query filters by both.
 */

import { Types } from "mongoose";
import { connectDB } from "@/lib/db/mongoose";
import { Notification, type INotification } from "@/lib/db/models/Notification";

const DEFAULT_RECENT_LIMIT = 10;
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

function clampLimit(limit: number | undefined, def: number): number {
  const n = Number.isFinite(limit) ? (limit as number) : def;
  return Math.min(Math.max(1, Math.trunc(n)), MAX_PAGE_LIMIT);
}

// Opaque cursor = base64url of "<createdAt ms>|<_id>".
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.getTime()}|${id}`, "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [ms, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!ms || !id || !Types.ObjectId.isValid(id)) return null;
    const ts = Number(ms);
    if (!Number.isFinite(ts)) return null;
    return { createdAt: new Date(ts), id };
  } catch {
    return null;
  }
}

/**
 * Returns the count of unread notifications for a user in a workspace.
 * Backed by the { workspaceId, recipientWorkosUserId, read, createdAt: -1 } index.
 */
export async function getUnreadCount(
  workspaceId: string,
  workosUserId: string,
): Promise<number> {
  if (!workspaceId || !workosUserId) return 0;
  await connectDB();
  return Notification.countDocuments({
    workspaceId,
    recipientWorkosUserId: workosUserId,
    read: false,
  });
}

/**
 * Returns the most recent N notifications for a user in a workspace, newest
 * first. Used for the notification popover. Default limit is 10.
 * Backed by the { workspaceId, recipientWorkosUserId, createdAt: -1 } index.
 */
export async function getRecentNotifications(
  workspaceId: string,
  workosUserId: string,
  limit?: number,
): Promise<INotification[]> {
  if (!workspaceId || !workosUserId) return [];
  const n = clampLimit(limit, DEFAULT_RECENT_LIMIT);
  await connectDB();
  return Notification.find({
    workspaceId,
    recipientWorkosUserId: workosUserId,
  })
    .sort({ createdAt: -1, _id: -1 })
    .limit(n)
    .lean() as Promise<INotification[]>;
}

/**
 * Cursor-paginated list of notifications for the notifications page, newest
 * first. Default limit is 20.
 *
 * Cursor encodes { createdAt, _id } as base64url "timestamp|id".
 * Backed by the { workspaceId, recipientWorkosUserId, createdAt: -1 } index.
 */
export async function listNotifications(
  workspaceId: string,
  workosUserId: string,
  opts?: { cursor?: string; limit?: number },
): Promise<{ items: INotification[]; nextCursor: string | null }> {
  if (!workspaceId || !workosUserId) return { items: [], nextCursor: null };

  const limit = clampLimit(opts?.limit, DEFAULT_PAGE_LIMIT);
  await connectDB();

  const filter: Record<string, unknown> = {
    workspaceId,
    recipientWorkosUserId: workosUserId,
  };

  if (opts?.cursor) {
    const c = decodeCursor(opts.cursor);
    if (c) {
      filter.$or = [
        { createdAt: { $lt: c.createdAt } },
        { createdAt: c.createdAt, _id: { $lt: new Types.ObjectId(c.id) } },
      ];
    }
  }

  const docs = (await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean()) as INotification[];

  const hasMore = docs.length > limit;
  const items = hasMore ? docs.slice(0, limit) : docs;
  const last = items[items.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor(new Date(last.createdAt as unknown as Date), String(last._id)) : null;

  return { items, nextCursor };
}
