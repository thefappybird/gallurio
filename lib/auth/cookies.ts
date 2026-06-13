import "server-only";

/**
 * Whether auth-related cookies should carry the `Secure` attribute.
 *
 * Mirrors @workos-inc/authkit-nextjs's own cookie logic, which derives `Secure`
 * from the protocol of the redirect URI rather than from NODE_ENV. This matters
 * for local production builds (`pnpm build && pnpm start`) served over
 * http://localhost: there NODE_ENV is "production" but the origin is plaintext
 * HTTP, so a `Secure` cookie is silently discarded by the browser — which drops
 * the session and bounces the user straight back to sign-in.
 *
 *   https redirect URI -> Secure   (real deployments)
 *   http  redirect URI -> not Secure (localhost / LAN dev over HTTP)
 *
 * When the redirect URI is unset or unparseable, fall back to NODE_ENV so we
 * still default to Secure in production-like environments.
 *
 * Keeping this in lockstep with authkit's getCookieOptions() guarantees our
 * hand-rolled session/CSRF cookies and authkit's own cookies agree on `Secure`.
 */
export function authCookieSecure(): boolean {
  const uri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI;
  if (uri) {
    try {
      return new URL(uri).protocol === "https:";
    } catch {
      // Unparseable URI — fall through to the NODE_ENV default.
    }
  }
  return process.env.NODE_ENV === "production";
}
