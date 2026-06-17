"use server";

import mongoose from "mongoose";
import { revalidatePath } from "next/cache";
import { ownerContext } from "@/lib/auth/ownerContext";
import { connectDB } from "@/lib/db/mongoose";
import { Notification } from "@/lib/db/models/Notification";
import { getIO } from "@/lib/sockets/io";

/**
 * Mark a single notification as read.
 *
 * Tenant isolation: filter includes _id + workspaceId + recipientWorkosUserId.
 * A notification not belonging to the current user or workspace is silently a
 * no-op (returns {}) — callers should not branch on "not found" vs "already read".
 */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<{ error?: string }> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  if (!mongoose.Types.ObjectId.isValid(notificationId)) {
    return { error: "Invalid notification id" };
  }

  await connectDB();

  await Notification.updateOne(
    {
      _id: new mongoose.Types.ObjectId(notificationId),
      workspaceId: ctx.workspace._id,
      recipientWorkosUserId: ctx.userId,
    },
    { $set: { read: true, readAt: new Date() } },
  );

  try {
    getIO()?.to(`user:${ctx.userId}`).emit("notification:read", { id: notificationId });
  } catch (err) {
    console.error("[notifications] socket emit error (markRead):", err);
  }

  revalidatePath("/[locale]/notifications", "page");
  return {};
}

/**
 * Mark all notifications as read for the current user in the active workspace.
 */
export async function markAllNotificationsReadAction(): Promise<{ error?: string }> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  await connectDB();

  await Notification.updateMany(
    {
      workspaceId: ctx.workspace._id,
      recipientWorkosUserId: ctx.userId,
      read: false,
    },
    { $set: { read: true, readAt: new Date() } },
  );

  try {
    getIO()?.to(`user:${ctx.userId}`).emit("notification:readAll", {});
  } catch (err) {
    console.error("[notifications] socket emit error (markAllRead):", err);
  }

  revalidatePath("/[locale]/notifications", "page");
  return {};
}
