/**
 * Carries the resolved portfolio workspace slug from proxy.ts (which sees the
 * Host header / rewritten path) down to app/(public)/layout.tsx (which owns
 * <html> but, as a root layout, cannot read the [orgSlug] child route's
 * params).
 *
 * Kept as its own leaf module (no other exports) so importing it — from
 * either proxy.ts or the public layout — never pulls in proxy.ts's
 * module-scope `authkitMiddleware()`/`createIntlMiddleware()` calls.
 *
 * Trust boundary: only proxy.ts may set this header. proxy.ts strips any
 * inbound copy once, at the top of `proxy()`, before any branch runs — see
 * that file for the stamping logic.
 */
export const PORTFOLIO_SLUG_HEADER = "x-gallurio-portfolio-slug";
