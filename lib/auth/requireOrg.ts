import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { connectDB } from "@/lib/db/mongoose";
import { routing } from "@/lib/i18n/routing";
import { User, Workspace, type WorkspaceDoc } from "@/lib/db/models";
import { isWorkspaceGated } from "@/lib/billing/access";
import { expireGrantIfPast } from "@/lib/billing/checkGrantExpiry";
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
  const resolved = await resolveOrgContext();
  if (resolved.kind === "signed-out") redirect(localized("/sign-in", locale));
  if (resolved.kind === "no-workspace") redirect(localized("/onboarding", locale));

  const { ctx, onboardingCompletedAt } = resolved;

  // Onboarding completion only applies to owners (members never onboard).
  if (ctx.role === "owner" && !opts.allowDuringOnboarding && !onboardingCompletedAt) {
    redirect(localized("/onboarding", locale));
  }

  if (!opts.allowWhenGated && isWorkspaceGated(ctx.workspace)) {
    redirect(localized("/subscribe", locale));
  }

  return ctx;
}

type ResolvedOrg =
  | { kind: "signed-out" }
  | { kind: "no-workspace" }
  | { kind: "ok"; ctx: OrgContext; onboardingCompletedAt: Date | null };

/**
 * Argument-free and redirect-free so React cache() dedupes it per request:
 * the (app) layout and the page both call requireOrg() but the DB/session
 * work runs once. Gates stay in requireOrg() since they depend on opts.
 */
const resolveOrgContext = cache(async (): Promise<ResolvedOrg> => {
  const authUser = await getAuthUser();
  if (!authUser) return { kind: "signed-out" };

  await connectDB();

  const user = await User.findOne({ workosUserId: authUser.workosUserId }).lean();
  if (!user) return { kind: "no-workspace" };

  const workspaceId = await getActiveWorkspaceId(user.memberships);
  if (!workspaceId) return { kind: "no-workspace" };

  let workspace = await Workspace.findById(workspaceId).lean<WorkspaceDoc>();
  if (!workspace) return { kind: "no-workspace" };
  workspace = await expireGrantIfPast(workspace);

  const membership = user.memberships.find(
    (m) => String(m.workspaceId) === workspaceId,
  );

  const isOwner =
    workspace.ownerUserId === authUser.workosUserId ||
    membership?.role === "owner";

  return {
    kind: "ok",
    onboardingCompletedAt: user.onboardingCompletedAt ?? null,
    ctx: {
      userId: authUser.workosUserId,
      workspaceId,
      role: isOwner ? "owner" : "staff",
      workspace,
      userAvatarUrl: user.avatarUrl ?? null,
    },
  };
});

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

/**
 * Non-redirecting read of the cached org context (same per-request cache as
 * requireOrg). Returns null when signed out / no workspace. For read-only
 * helpers (e.g. vocabulary resolution) that must not gate or redirect.
 */
export async function peekOrgContext(): Promise<OrgContext | null> {
  const resolved = await resolveOrgContext();
  return resolved.kind === "ok" ? resolved.ctx : null;
}
