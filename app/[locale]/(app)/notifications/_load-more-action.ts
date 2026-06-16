"use server";

import { ownerContext } from "@/lib/auth/ownerContext";
import { listNotifications } from "@/lib/db/queries/notifications";

export interface SerializedNotification {
  _id: string;
  type: string;
  title: string;
  body: string;
  href: string;
  entityId: string;
  entityType: string;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export async function loadMoreNotificationsAction(
  cursor: string,
): Promise<{ items: SerializedNotification[]; nextCursor: string | null; error?: string }> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { items: [], nextCursor: null, error: ctx.error };

  const { items, nextCursor } = await listNotifications(
    String(ctx.workspace._id),
    ctx.userId,
    { cursor, limit: 20 },
  );

  return {
    items: items.map((n) => ({
      _id: String(n._id),
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      entityId: String(n.entityId),
      entityType: n.entityType,
      read: n.read,
      readAt: n.readAt ? new Date(n.readAt as unknown as Date).toISOString() : null,
      createdAt: new Date(n.createdAt as unknown as Date).toISOString(),
    })),
    nextCursor,
  };
}
