// Client-only helpers for the public, unauthenticated Portfolio Maker demo
// (app/[locale]/portfolio-maker-demo). Never used by the real (authenticated)
// editor — keeps demo state fully isolated from any real workspace's data.
"use client";

export const DEMO_SESSION_KEY = "gallurio:portfolio-maker-demo:session";
// Must match the demo1mo entry in lib/db/seed-fixtures.ts — do not change
// independently of that seed.
export const DEMO_PROMO_CODE = "DEMOPRO2026";
export const DEMO_PROMO_CLAIMED_KEY = "gallurio:portfolio-maker-demo:promo-claimed";
export const DEMO_IMAGE_COUNT_KEY_PREFIX = "gallurio:portfolio-maker-demo:images:";

/** Reads (or generates + persists) this browser's demo session id. */
export function getOrCreateDemoSessionId(): string {
  if (typeof window === "undefined") return "";
  const existing = window.localStorage.getItem(DEMO_SESSION_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  window.localStorage.setItem(DEMO_SESSION_KEY, id);
  return id;
}

/** Draft-buffer localStorage key for a demo session — distinct namespace from
 *  the real editor's `gallurio:portfolio-draft:${slug}` key so a demo session
 *  can never collide with or leak into a real workspace's draft. */
export function demoDraftKey(sessionId: string): string {
  return `gallurio:portfolio-maker-demo:draft:${sessionId}`;
}

/** True once the promo-reveal line has been shown once in this browser. */
export function isDemoPromoClaimed(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEMO_PROMO_CLAIMED_KEY) === "1";
}

/** Marks the promo-reveal as shown so later gate hits don't repeat it. */
export function markDemoPromoClaimed(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_PROMO_CLAIMED_KEY, "1");
}
