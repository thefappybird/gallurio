// Shared by the checkout route and the /subscribe page for their `returnTo`
// query/body param. Mirrors app/[locale]/(auth)/_actions.ts's sanitizeReturnTo
// (kept separate — that one is private to the auth action module).
export function sanitizeLocalReturnTo(returnTo: string | undefined | null): string | undefined {
  if (!returnTo) return undefined;
  // Only allow local paths. Second char must not be "/" or "\" — browsers
  // normalize "/\evil.com" in Location headers to protocol-relative
  // "//evil.com", which would be an open redirect.
  if (!/^\/[^/\\]/.test(returnTo)) return undefined;
  try {
    const base = "https://gallurio.internal";
    if (new URL(returnTo, base).origin !== base) return undefined;
  } catch {
    return undefined;
  }
  return returnTo;
}
