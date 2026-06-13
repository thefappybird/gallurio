import "server-only";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verifies a Cloudflare Turnstile token server-side.
 *
 * Fails closed: returns false on any of:
 *   - missing or empty token
 *   - missing TURNSTILE_SECRET_KEY env var
 *   - non-2xx HTTP response from Cloudflare
 *   - Cloudflare reports success: false
 *   - unexpected errors (logged, not swallowed)
 *
 * The optional ip parameter is forwarded to Cloudflare for additional signal
 * but is not required.
 */
export async function verifyTurnstileToken(
  token: string | null | undefined,
  ip?: string,
): Promise<boolean> {
  if (!token) return false;

  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("[turnstile] TURNSTILE_SECRET_KEY is not set");
    return false;
  }

  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);

  let res: Response;
  try {
    res = await fetch(SITEVERIFY_URL, {
      method: "POST",
      body,
      // Never cache verification requests.
      cache: "no-store",
    });
  } catch (err) {
    console.error("[turnstile] Network error contacting siteverify:", err);
    return false;
  }

  if (!res.ok) {
    console.error("[turnstile] siteverify returned HTTP", res.status);
    return false;
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (err) {
    console.error("[turnstile] Failed to parse siteverify response:", err);
    return false;
  }

  if (
    typeof data !== "object" ||
    data === null ||
    !("success" in data) ||
    typeof (data as { success: unknown }).success !== "boolean"
  ) {
    console.error("[turnstile] Unexpected siteverify response shape:", data);
    return false;
  }

  return (data as { success: boolean }).success;
}
