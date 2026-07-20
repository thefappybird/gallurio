import "server-only";
import { headers } from "next/headers";
import { withAuth } from "@workos-inc/authkit-nextjs";

// AuthKit's middleware tags every request it covers with this header
// (@workos-inc/authkit-nextjs session.ts `middlewareHeaderName` — not exported
// from the package's public API, but the literal value is stable and proxy.ts
// already references this same header name in a comment).
const AUTHKIT_MIDDLEWARE_HEADER = "x-workos-middleware";

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
  // withAuth() throws a plain Error when the current request wasn't covered
  // by AuthKit's middleware (e.g. a 404 rendered under a public path that
  // proxy.ts deliberately skips authkit for). Mirror AuthKit's own check so
  // an uncovered route resolves to "no session" instead of throwing — same
  // signal a covered-but-anonymous route already returns.
  const headersList = await headers();
  if (!headersList.get(AUTHKIT_MIDDLEWARE_HEADER)) return null;

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
