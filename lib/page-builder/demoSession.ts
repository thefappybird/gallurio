// Client-only helpers for the public, unauthenticated Portfolio Maker demo
// (app/[locale]/portfolio-maker-demo). Never used by the real (authenticated)
// editor — keeps demo state fully isolated from any real workspace's data.
"use client";

export const DEMO_SESSION_KEY = "gallurio:portfolio-maker-demo:session";
// Must match the demo1mo entry in lib/db/seed-fixtures.ts — do not change
// independently of that seed.
export const DEMO_PROMO_CODE = "DEMOPRO2026";
export const DEMO_PROMO_CLAIMED_KEY = "gallurio:portfolio-maker-demo:promo-claimed";
// Native `storage` events don't fire in the same tab that wrote the value —
// dispatch this so same-tab listeners (e.g. the disclaimer banner) can react.
export const DEMO_PROMO_CLAIMED_EVENT = "gallurio:demo-promo-claimed";
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
  window.dispatchEvent(new Event(DEMO_PROMO_CLAIMED_EVENT));
}

/** An image uploaded this demo session, shown in the demo image picker's grid. */
export type DemoLibraryImage = {
  id: string;
  publicId: string;
  url: string;
  width?: number;
  height?: number;
};

/** Uploaded-image-library localStorage key for a demo session — sibling to
 *  `demoDraftKey`, keyed by demoSessionId so it's shared by every image
 *  picker instance (banner image, gallery photos, etc.) within one session. */
export function demoImageLibraryKey(sessionId: string): string {
  return `${DEMO_IMAGE_COUNT_KEY_PREFIX}${sessionId}`;
}

/** Reads this session's uploaded-image library (empty array if none/unparsable). */
export function readDemoImageLibrary(sessionId: string): DemoLibraryImage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(demoImageLibraryKey(sessionId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DemoLibraryImage[]) : [];
  } catch {
    return [];
  }
}

/** Persists this session's uploaded-image library. */
export function writeDemoImageLibrary(sessionId: string, images: DemoLibraryImage[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(demoImageLibraryKey(sessionId), JSON.stringify(images));
}
