"use server";

import { connectDB } from "@/lib/db/mongoose";
import { Workspace, User } from "@/lib/db/models";
import { slugSchema } from "@/lib/validators/workspace";
import { getAuthUser } from "@/lib/auth/session";
import { rateLimit } from "@/lib/server/rateLimit";

export type SlugAvailability = {
  available: boolean;
  reason?: "invalid" | "taken";
};

/**
 * Check whether a workspace slug is available.
 * Authenticated — works both during onboarding (no workspace yet) and in
 * settings (owner of an existing workspace). The caller's own workspace is
 * excluded so re-checking the current slug always returns available.
 */
export async function checkSlugAvailabilityAction(
  slug: string,
): Promise<SlugAvailability> {
  const authUser = await getAuthUser();
  if (!authUser) return { available: false, reason: "taken" };

  // Rate-limit by user id to blunt abuse (cheap probe).
  const rl = rateLimit(`slug-check:${authUser.workosUserId}`, {
    limit: 30,
    windowMs: 60_000,
  });
  if (!rl.ok) return { available: false, reason: "taken" };

  // Validate format — no DB hit for clearly invalid values.
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return { available: false, reason: "invalid" };

  const normalized = parsed.data.toLowerCase().trim();

  await connectDB();

  // Resolve caller's own workspace (if any) so we can exclude it from the check.
  const userDoc = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 },
  ).lean();
  const ownWorkspaceId =
    userDoc?.memberships.find((m) => m.role === "owner")?.workspaceId ?? null;

  const clash = await Workspace.findOne({
    slug: normalized,
    ...(ownWorkspaceId ? { _id: { $ne: ownWorkspaceId } } : {}),
  })
    .select("_id")
    .lean();

  if (clash) return { available: false, reason: "taken" };
  return { available: true };
}
