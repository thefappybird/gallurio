import type { Types } from "mongoose";
import { User } from "@/lib/db/models";

/** Activity pages never need more than 50 unique actors. */
export const MAX_ACTOR_IDS = 50;

/**
 * workosUserId -> trimmed display name, restricted to members of `workspaceId`
 * (prevents cross-tenant user enumeration). One query; blank names omitted.
 */
export async function resolveActorNames(
  workspaceId: Types.ObjectId,
  ids: string[]
): Promise<Record<string, string>> {
  const safeIds = [...new Set(ids.filter(Boolean))].slice(0, MAX_ACTOR_IDS);
  if (safeIds.length === 0) return {};

  const users = await User.find(
    {
      workosUserId: { $in: safeIds },
      "memberships.workspaceId": workspaceId,
    },
    { workosUserId: 1, name: 1 }
  ).lean<{ workosUserId: string; name?: string }[]>();

  const result: Record<string, string> = {};
  for (const u of users) {
    if (u.name?.trim()) result[u.workosUserId] = u.name.trim();
  }
  return result;
}
