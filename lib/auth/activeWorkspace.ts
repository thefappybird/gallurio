import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import { authCookieSecure } from "@/lib/auth/cookies";
import mongoose from "mongoose";

const COOKIE_NAME = "gw_active_ws";
const HMAC_ALGO = "sha256";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getSecret(): string {
  const secret = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET;
  if (!secret) throw new Error("ACTIVE_WORKSPACE_COOKIE_SECRET is not set");
  return secret;
}

function sign(workspaceId: string): string {
  const mac = createHmac(HMAC_ALGO, getSecret()).update(workspaceId).digest("hex");
  return `${workspaceId}.${mac}`;
}

function verify(raw: string): string | null {
  const dot = raw.lastIndexOf(".");
  if (dot === -1) return null;

  const workspaceId = raw.slice(0, dot);
  const mac = raw.slice(dot + 1);

  if (!workspaceId || !mac) return null;

  const expected = createHmac(HMAC_ALGO, getSecret()).update(workspaceId).digest("hex");

  try {
    const macBuf = Buffer.from(mac, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (macBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(macBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  return workspaceId;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export type UserMembership = {
  workspaceId: mongoose.Types.ObjectId | string;
  role: "owner" | "staff";
  lastAccessedAt?: Date | null;
};

/**
 * Resolves the active workspace id for the given user memberships.
 *
 * Resolution order:
 *   1. Signed gw_active_ws cookie — validated against memberships.
 *   2. Membership with the most-recent lastAccessedAt.
 *   3. Sole membership (when only one exists).
 *   4. null — caller should redirect to workspace chooser or onboarding.
 *
 * The cookie value is NEVER trusted as an authorization input. It is always
 * intersected with the caller-supplied memberships list (sourced from the DB).
 */
export async function getActiveWorkspaceId(
  userMemberships: UserMembership[],
): Promise<string | null> {
  if (userMemberships.length === 0) return null;

  const membershipIds = new Set(
    userMemberships.map((m) => String(m.workspaceId)),
  );

  // 1. Try the signed cookie.
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (raw) {
    const fromCookie = verify(raw);
    if (fromCookie && membershipIds.has(fromCookie)) {
      return fromCookie;
    }
    // Cookie is present but invalid/tampered/stale — fall through.
  }

  // 2. Most-recently accessed membership.
  const withTimestamp = userMemberships.filter((m) => m.lastAccessedAt != null);
  if (withTimestamp.length > 0) {
    withTimestamp.sort(
      (a, b) =>
        (b.lastAccessedAt as Date).getTime() - (a.lastAccessedAt as Date).getTime(),
    );
    return String(withTimestamp[0].workspaceId);
  }

  // 3. Sole membership.
  if (userMemberships.length === 1) {
    return String(userMemberships[0].workspaceId);
  }

  // 4. Cannot determine — caller redirects to chooser.
  return null;
}

/**
 * Sets the active-workspace cookie and stamps lastAccessedAt on the membership
 * for the given workosUserId. Call after onboarding completion or workspace switch.
 */
export async function setActiveWorkspace(
  workosUserId: string,
  workspaceId: string,
): Promise<void> {
  const jar = await cookies();
  const value = sign(workspaceId);

  jar.set(COOKIE_NAME, value, {
    httpOnly: true,
    secure: authCookieSecure(),
    sameSite: "lax",
    path: "/",
    // 90-day shelf-life; the session itself is controlled by wos-session.
    maxAge: 60 * 60 * 24 * 90,
  });

  // Stamp lastAccessedAt on the matching membership.
  await connectDB();
  await User.updateOne(
    { workosUserId, "memberships.workspaceId": new mongoose.Types.ObjectId(workspaceId) },
    { $set: { "memberships.$.lastAccessedAt": new Date() } },
  );
}

/**
 * Clears the active-workspace cookie. Call on sign-out.
 */
export async function clearActiveWorkspace(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}
