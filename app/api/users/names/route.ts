import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/auth/requireOrg";
import { connectDB } from "@/lib/db/mongoose";
import { resolveActorNames } from "@/lib/users/actor-names";

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

  await connectDB();

  return NextResponse.json(await resolveActorNames(workspace._id, ids));
}
