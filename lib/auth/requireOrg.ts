import "server-only";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { connectDB } from "@/lib/db/mongoose";
import { routing } from "@/lib/i18n/routing";
import { User, Workspace, type WorkspaceDoc } from "@/lib/db/models";
import { isWorkspaceGated } from "@/lib/billing/access";
import { getAuthUser } from "./session";
import { getActiveWorkspaceId } from "./activeWorkspace";

export type OrgContext = {
  /** WorkOS user id (user_...) */
  userId: string;
  /** MongoDB workspace _id as string */
  workspaceId: string;
  role: "owner" | "staff";
  workspace: WorkspaceDoc;
  /** Uploaded profile photo from the MongoDB User doc (not the identity provider's). */
  userAvatarUrl: string | null;
};

function localized(href: string, locale: string): string {
  return locale === routing.defaultLocale ? href : `/${locale}${href}`;
}

/**
 * Resolves the authenticated user's active workspace and returns an OrgContext.
 *
 * Resolution:
 *   1. getAuthUser() — null -> redirect to localized /sign-in
 *   2. Load User by workosUserId
 *   3. Resolve active workspace via getActiveWorkspaceId(user.memberships)
 *      — none -> redirect to localized /onboarding
 *   4. Load Workspace by _id
 *      — not found -> redirect to localized /onboarding
 *   5. Derive role: workspace.ownerUserId === workosUserId
 *      OR membership.role === "owner"
 *   6. Onboarding gate (owners only, bypassed by allowDuringOnboarding)
 *   7. Subscription gate (isWorkspaceGated, bypassed by allowWhenGated)
 *      — gated -> redirect to localized /subscribe
 */
export async function requireOrg(
  opts: { allowDuringOnboarding?: boolean; allowWhenGated?: boolean } = {},
): Promise<OrgContext> {
  const locale = await getLocale();
  const authUser = await getAuthUser();
  if (!authUser) redirect(localized("/sign-in", locale));

  await connectDB();

  const user = await User.findOne({ workosUserId: authUser.workosUserId }).lean();
  if (!user) redirect(localized("/onboarding", locale));

  const workspaceId = await getActiveWorkspaceId(user.memberships);
  if (!workspaceId) redirect(localized("/onboarding", locale));

  const workspace = await Workspace.findById(workspaceId).lean<WorkspaceDoc>();
  if (!workspace) redirect(localized("/onboarding", locale));

  const membership = user.memberships.find(
    (m) => String(m.workspaceId) === workspaceId,
  );

  const isOwner =
    workspace.ownerUserId === authUser.workosUserId ||
    membership?.role === "owner";

  // Onboarding completion only applies to owners (members never onboard).
  if (isOwner && !opts.allowDuringOnboarding && !user.onboardingCompletedAt) {
    redirect(localized("/onboarding", locale));
  }

  if (!opts.allowWhenGated && isWorkspaceGated(workspace)) {
    redirect(localized("/subscribe", locale));
  }

  const role: "owner" | "staff" = isOwner ? "owner" : "staff";

  return {
    userId: authUser.workosUserId,
    workspaceId,
    role,
    workspace,
    userAvatarUrl: user.avatarUrl ?? null,
  };
}

/**
 * Requires the authenticated user to be the workspace owner.
 * Throws Forbidden for staff members.
 */
export async function requireRole(role: "owner"): Promise<OrgContext> {
  const ctx = await requireOrg();
  if (ctx.role !== role) {
    throw new Error("Forbidden: insufficient role");
  }
  return ctx;
}
