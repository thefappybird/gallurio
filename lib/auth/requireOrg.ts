import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongoose";
import { Workspace, type WorkspaceDoc } from "@/lib/db/models";

export type OrgContext = {
  userId: string;
  clerkOrgId: string;
  role: "owner" | "staff";
  workspace: WorkspaceDoc;
};

export async function requireOrg(): Promise<OrgContext> {
  const session = await auth();
  if (!session.userId) redirect("/sign-in");
  if (!session.orgId) redirect("/onboarding");

  await connectDB();
  const workspace = await Workspace.findOne({ clerkOrgId: session.orgId }).lean<WorkspaceDoc>();
  if (!workspace) redirect("/onboarding");

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
