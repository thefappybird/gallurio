import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongoose";
import { User, Workspace, type WorkspaceDoc, type UserDoc } from "@/lib/db/models";

export type OrgContext = {
  userId: string;
  clerkOrgId: string;
  role: "owner" | "staff";
  workspace: WorkspaceDoc;
};

export async function requireOrg(opts: { allowDuringOnboarding?: boolean } = {}): Promise<OrgContext> {
  const session = await auth();
  if (!session.userId) redirect("/sign-in");
  if (!session.orgId) redirect("/onboarding");

  await connectDB();

  const [user, workspace] = await Promise.all([
    User.findOne({ clerkUserId: session.userId })
      .select({ onboardingStep: 1, onboardingCompletedAt: 1 })
      .lean<Pick<UserDoc, "onboardingStep" | "onboardingCompletedAt">>(),
    Workspace.findOne({ clerkOrgId: session.orgId }).lean<WorkspaceDoc>(),
  ]);

  if (!workspace) redirect("/onboarding");

  if (!opts.allowDuringOnboarding) {
    const done = user?.onboardingStep === "done" || Boolean(user?.onboardingCompletedAt);
    if (!done) redirect("/onboarding");
  }

  const role: "owner" | "staff" =
    session.orgRole === "org:admin" || workspace.ownerUserId === session.userId
      ? "owner"
      : "staff";

  return {
    userId: session.userId,
    clerkOrgId: session.orgId,
    role,
    workspace,
  };
}

export async function requireRole(role: "owner"): Promise<OrgContext> {
  const ctx = await requireOrg();
  if (ctx.role !== role) {
    throw new Error("Forbidden: insufficient role");
  }
  return ctx;
}
