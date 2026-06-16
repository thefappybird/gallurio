import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";

export const runtime = "nodejs";

/**
 * GET /api/users/names?ids=<workosUserId>&ids=<workosUserId>...
 *
 * Returns a map of workosUserId → display name for the given set of user IDs,
 * scoped to the caller's workspace. Used by the activity timeline to resolve
 * actor names without exposing the full user document.
 */
export async function GET(req: Request) {
  const { workspace } = await requireOrg();

  const url = new URL(req.url);
  const ids = url.searchParams.getAll("ids").filter(Boolean);

  if (ids.length === 0) {
    return NextResponse.json({});
  }

  // Cap to avoid abuse — activity pages never need more than 50 unique actors.
  const safeIds = ids.slice(0, 50);

  await connectDB();

  // Constrain to members of the caller's workspace to prevent cross-tenant enumeration.
  const users = await User.find(
    {
      workosUserId: { $in: safeIds },
      "memberships.workspaceId": workspace._id,
    },
    { workosUserId: 1, name: 1 },
  ).lean<{ workosUserId: string; name?: string }[]>();

  const result: Record<string, string> = {};
  for (const u of users) {
    if (u.name?.trim()) result[u.workosUserId] = u.name.trim();
  }

  return NextResponse.json(result);
}
