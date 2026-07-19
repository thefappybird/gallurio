import mongoose from "mongoose";
import { TeamMembership, User } from "@/lib/db/models";
import type { NotificationRecipient } from "./types";

/**
 * Resolve notification recipients for a team, scoped by workspaceId+teamId.
 * Returns deduped NotificationRecipient[] (empty array when no members found).
 */
export async function resolveTeamRecipients(
  workspaceId: string | mongoose.Types.ObjectId,
  teamId: string | mongoose.Types.ObjectId,
): Promise<NotificationRecipient[]> {
  const memberships = await TeamMembership.find(
    { workspaceId, teamId },
    { workosUserId: 1 },
  ).lean();

  if (memberships.length === 0) return [];

  // Dedupe workosUserIds before hitting User collection.
  const memberIds = [...new Set(memberships.map((m) => m.workosUserId))];

  const users = await User.find(
    { workosUserId: { $in: memberIds } },
    { workosUserId: 1, email: 1, name: 1 },
  ).lean();

  // Dedupe by workosUserId using a Map (handles duplicate memberships).
  const byId = new Map<string, NotificationRecipient>();
  for (const u of users) {
    if (!byId.has(u.workosUserId)) {
      byId.set(u.workosUserId, {
        workosUserId: u.workosUserId,
        email: u.email,
        name: u.name || undefined,
      });
    }
  }

  return [...byId.values()];
}

interface ResolveStatusChangeArgs {
  workspaceId: string | mongoose.Types.ObjectId;
  teamId?: string | mongoose.Types.ObjectId | null;
  ownerUserId: string;
  ownerEmail?: string | null;
}

/**
 * Resolve notification recipients for a status-change event:
 * team members (when teamId is provided) + workspace owner (when ownerEmail is
 * present), deduped by workosUserId.
 */
export async function resolveStatusChangeRecipients({
  workspaceId,
  teamId,
  ownerUserId,
  ownerEmail,
}: ResolveStatusChangeArgs): Promise<NotificationRecipient[]> {
  const recipientMap = new Map<string, NotificationRecipient>();

  if (teamId) {
    const teamMembers = await resolveTeamRecipients(workspaceId, teamId);
    for (const r of teamMembers) {
      recipientMap.set(r.workosUserId, r);
    }
  }

  if (ownerEmail) {
    // Owner may already be in the map as a team member — the Map dedupes.
    if (!recipientMap.has(ownerUserId)) {
      recipientMap.set(ownerUserId, { workosUserId: ownerUserId, email: ownerEmail });
    }
  }

  return [...recipientMap.values()];
}
