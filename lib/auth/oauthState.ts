/**
 * Signing and verification helpers for the OAuth state parameter.
 *
 * The state object carries optional context through the WorkOS authorization
 * redirect without exposing it to tampering. Sign-in/sign-up actions build the
 * Google authorization URL with a signed state; the callback route verifies it.
 *
 * Format: base64url(JSON) + "." + HMAC-SHA256(base64url(JSON), secret)
 *
 * The payload includes issuedAt so stale states can be rejected (default TTL
 * 10 minutes). The secret is ACTIVE_WORKSPACE_COOKIE_SECRET (reused because
 * both use cases are tied to the same session lifecycle).
 */

import { createHmac, timingSafeEqual } from "crypto";

const HMAC_ALGO = "sha256";
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export type OAuthStatePayload = {
  /** Target locale for post-auth redirects (e.g. "en", "fil"). */
  locale: string;
  /** Optional return path after authentication (must be a local pathname). */
  returnTo?: string;
  /** Unix timestamp (ms) when the state was created. Used for TTL checks. */
  issuedAt: number;
};

function getSecret(): string {
  const secret = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET;
  if (!secret) throw new Error("ACTIVE_WORKSPACE_COOKIE_SECRET is not set");
  return secret;
}

function toBase64Url(buf: Buffer | string): string {
  const b64 = Buffer.isBuffer(buf)
    ? buf.toString("base64")
    : Buffer.from(buf).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4;
  return Buffer.from(pad ? padded + "=".repeat(4 - pad) : padded, "base64");
}

function computeMac(payload: string, secret: string): string {
  return createHmac(HMAC_ALGO, secret).update(payload).digest("hex");
}

/**
 * Signs an OAuthStatePayload and returns a compact state string safe for
 * use in a URL query parameter.
 */
export function signOAuthState(
  payload: Omit<OAuthStatePayload, "issuedAt"> & { issuedAt?: number },
): string {
  const full: OAuthStatePayload = {
    ...payload,
    issuedAt: payload.issuedAt ?? Date.now(),
  };
  const encoded = toBase64Url(JSON.stringify(full));
  const mac = computeMac(encoded, getSecret());
  return `${encoded}.${mac}`;
}

/**
 * Verifies a state string produced by signOAuthState.
 *
 * Returns the decoded payload on success, or null when:
 *   - the format is invalid
 *   - the HMAC does not match (tampered)
 *   - the state is older than STATE_TTL_MS
 */
export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const dot = state.lastIndexOf(".");
  if (dot === -1) return null;

  const encoded = state.slice(0, dot);
  const mac = state.slice(dot + 1);

  if (!encoded || !mac) return null;

  const secret = getSecret();
  const expected = computeMac(encoded, secret);

  try {
    const macBuf = Buffer.from(mac, "hex");
    const expectedBuf = Buffer.from(expected, "hex");
    if (macBuf.length !== expectedBuf.length) return null;
    if (!timingSafeEqual(macBuf, expectedBuf)) return null;
  } catch {
    return null;
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(fromBase64Url(encoded).toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }

  // Reject states older than TTL.
  if (!payload.issuedAt || Date.now() - payload.issuedAt > STATE_TTL_MS) {
    return null;
  }

  return payload;
}
