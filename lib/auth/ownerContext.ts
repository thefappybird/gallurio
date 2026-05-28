import { auth } from "@clerk/nextjs/server";
import { Workspace, User, type WorkspaceDoc } from "@/lib/db/models";
import { connectDB } from "@/lib/db/mongoose";

export type OwnerContext = {
  userId: string;
  clerkOrgId: string;
  workspace: WorkspaceDoc;
};

export type ActionResult = { ok?: boolean; error?: string };

export async function ownerContext(
  opts: { allowDuringOnboarding?: boolean } = {},
): Promise<OwnerContext | { error: string }> {
  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };
  if (!session.orgId) return { error: "No active workspace" };

  await connectDB();
  const workspace = await Workspace.findOne({ clerkOrgId: session.orgId });
  if (!workspace) return { error: "Workspace not found" };

  const isOwner =
    session.orgRole === "org:admin" || workspace.ownerUserId === session.userId;
  if (!isOwner) return { error: "Only the workspace owner can change this" };

  // Mirror requireOrg()'s onboarding gate so direct server-action calls can't
  // bypass the page-level redirect. The settings UI already enforces this at
  // render time; this is defense-in-depth for the action surface.
  if (!opts.allowDuringOnboarding) {
    const user = await User.findOne({ clerkUserId: session.userId })
      .select({ onboardingCompletedAt: 1 })
      .lean();
    if (!user?.onboardingCompletedAt) {
      return { error: "Finish onboarding before changing workspace settings" };
    }
  }

  return { userId: session.userId, clerkOrgId: session.orgId, workspace };
}
