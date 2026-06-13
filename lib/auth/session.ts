import "server-only";
import { withAuth } from "@workos-inc/authkit-nextjs";

export type AuthUser = {
  workosUserId: string;
  email: string;
  name: string;
  avatarUrl: string | null;
};

/**
 * Returns the authenticated WorkOS user, or null when no session exists.
 *
 * This is the single authoritative place in the codebase that reads WorkOS
 * identity. All server-side code that needs the current user must go through
 * this helper — never call withAuth() directly elsewhere.
 *
 * Field mapping from the WorkOS SDK:
 *   user.id            → workosUserId
 *   user.email         → email
 *   user.firstName/lastName → name (space-joined, trimmed)
 *   user.profilePictureUrl → avatarUrl
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const { user } = await withAuth();

  if (!user) return null;

  const firstName = user.firstName ?? "";
  const lastName = user.lastName ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ");

  return {
    workosUserId: user.id,
    email: user.email,
    name,
    avatarUrl: user.profilePictureUrl ?? null,
  };
}
