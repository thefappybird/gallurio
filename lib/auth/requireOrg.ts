import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/db/mongoose";
import { routing } from "@/lib/i18n/routing";
import { getLocale } from "next-intl/server";
import { User, Workspace, type WorkspaceDoc, type UserDoc } from "@/lib/db/models";

export type OrgContext = {
  userId: string;
  clerkOrgId: string;
  role: "owner" | "staff";
  workspace: WorkspaceDoc;
};

function localized(href: string, locale: string): string {
  return locale === routing.defaultLocale ? href : `/${locale}${href}`;
}

export async function requireOrg(opts: { allowDuringOnboarding?: boolean } = {}): Promise<OrgContext> {
  const session = await auth();
  const locale = await getLocale();
  if (!session.userId) redirect(localized("/sign-in", locale));
  if (!session.orgId) redirect(localized("/onboarding", locale));

  await connectDB();

  const [user, workspace] = await Promise.all([
    User.findOne({ clerkUserId: session.userId })
      .select({ onboardingStep: 1, onboardingCompletedAt: 1 })
      .lean<Pick<UserDoc, "onboardingStep" | "onboardingCompletedAt">>(),
    Workspace.findOne({ clerkOrgId: session.orgId }).lean<WorkspaceDoc>(),
  ]);

  if (!workspace) redirect(localized("/onboarding", locale));

  const isOwner =
    session.orgRole === "org:admin" || workspace.ownerUserId === session.userId;

  // Onboarding completion only applies to owners (members never onboard).
  if (isOwner && !opts.allowDuringOnboarding && !user?.onboardingCompletedAt) {
    redirect(localized("/onboarding", locale));
  }

  const role: "owner" | "staff" = isOwner ? "owner" : "staff";

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
