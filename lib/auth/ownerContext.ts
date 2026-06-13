import "server-only";
import { Workspace, User, type WorkspaceDoc } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";
import { getAuthUser } from "./session";
import { getActiveWorkspaceId } from "./activeWorkspace";

export type OwnerContext = {
  /** WorkOS user id (user_...) */
  userId: string;
  /** MongoDB workspace _id as string */
  workspaceId: string;
  workspace: WorkspaceDoc;
};

export type ActionResult = { ok?: boolean; error?: string };

/**
 * Server-action guard that resolves the active workspace and asserts ownership.
 *
 * Returns an error object instead of redirecting so server actions can return
 * a structured ActionResult to the client. Use requireOrg() in pages/layouts
 * where a redirect is appropriate.
 *
 * Resolution:
 *   1. getAuthUser() — null -> { error: "Not authenticated" }
 *   2. Load User by workosUserId; resolve active workspace
 *   3. Load Workspace by _id
 *   4. Assert ownership (ownerUserId === workosUserId)
 *   5. Onboarding gate (bypassed by allowDuringOnboarding)
 */
export async function ownerContext(
  opts: { allowDuringOnboarding?: boolean } = {},
): Promise<OwnerContext | { error: string }> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  await connectDB();

  const user = await User.findOne({ workosUserId: authUser.workosUserId }).lean();
  if (!user) return { error: "No active workspace" };

  const workspaceId = await getActiveWorkspaceId(user.memberships);
  if (!workspaceId) return { error: "No active workspace" };

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return { error: "Workspace not found" };

  const isOwner = workspace.ownerUserId === authUser.workosUserId;
  if (!isOwner) return { error: "Only the workspace owner can change this" };

  // Mirror requireOrg()'s onboarding gate so direct server-action calls can't
  // bypass the page-level redirect. Defense-in-depth for the action surface.
  if (!opts.allowDuringOnboarding) {
    if (!user.onboardingCompletedAt) {
      return { error: "Finish onboarding before changing workspace settings" };
    }
  }

  return { userId: authUser.workosUserId, workspaceId, workspace };
}
