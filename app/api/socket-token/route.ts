import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth/session";
import { getActiveWorkspaceId } from "@/lib/auth/activeWorkspace";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import { signSocketToken } from "@/lib/sockets/auth";

export const runtime = "nodejs";

export async function GET() {
  const authUser = await getAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  await connectDB();

  const user = await User.findOne({ workosUserId: authUser.workosUserId })
    .select({ memberships: 1 })
    .lean();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const workspaceId = await getActiveWorkspaceId(user.memberships);
  if (!workspaceId) {
    return NextResponse.json({ error: "No active workspace" }, { status: 401 });
  }

  const token = signSocketToken(authUser.workosUserId, workspaceId);
  return NextResponse.json({ token });
}
