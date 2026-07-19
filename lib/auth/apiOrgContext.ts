import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongoose";
import { User, Workspace, type WorkspaceDoc } from "@/lib/db/models";
import { isWorkspaceGated } from "@/lib/billing/access";
import { expireGrantIfPast } from "@/lib/billing/checkGrantExpiry";
import { getActiveWorkspaceId } from "./activeWorkspace";
import { type OrgContext } from "./requireOrg";
import { getAuthUser } from "./session";

type ApiOrgError =
  | "not_authenticated"
  | "no_active_workspace"
  | "workspace_not_found"
  | "onboarding_required"
  | "subscription_required";

type ApiOrgResult =
  | { ok: true; ctx: OrgContext }
  | { ok: false; response: NextResponse<{ error: ApiOrgError }> };

export async function requireApiOrg(
  opts: { allowDuringOnboarding?: boolean; allowWhenGated?: boolean } = {}
): Promise<ApiOrgResult> {
  const authUser = await getAuthUser();
  if (!authUser) {
    return { ok: false, response: NextResponse.json({ error: "not_authenticated" }, { status: 401 }) };
  }

  await connectDB();

  const user = await User.findOne({ workosUserId: authUser.workosUserId }).lean();
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "no_active_workspace" }, { status: 409 }) };
  }

  const workspaceId = await getActiveWorkspaceId(user.memberships);
  if (!workspaceId) {
    return { ok: false, response: NextResponse.json({ error: "no_active_workspace" }, { status: 409 }) };
  }

  let workspace = await Workspace.findById(workspaceId).lean<WorkspaceDoc>();
  if (!workspace) {
    return { ok: false, response: NextResponse.json({ error: "workspace_not_found" }, { status: 404 }) };
  }
  workspace = await expireGrantIfPast(workspace);

  const membership = user.memberships.find((m) => String(m.workspaceId) === workspaceId);
  const isOwner =
    workspace.ownerUserId === authUser.workosUserId ||
    membership?.role === "owner";

  if (isOwner && !opts.allowDuringOnboarding && !user.onboardingCompletedAt) {
    return { ok: false, response: NextResponse.json({ error: "onboarding_required" }, { status: 409 }) };
  }

  if (!opts.allowWhenGated && isWorkspaceGated(workspace)) {
    return { ok: false, response: NextResponse.json({ error: "subscription_required" }, { status: 402 }) };
  }

  return {
    ok: true,
    ctx: {
      userId: authUser.workosUserId,
      workspaceId,
      role: isOwner ? "owner" : "staff",
      workspace,
      userAvatarUrl: user.avatarUrl ?? null,
    },
  };
}
