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

/**
 * Read-only lookup for the REAL (authenticated) editor: reads this browser's
 * demo session id if one exists, WITHOUT generating one. Unlike
 * getOrCreateDemoSessionId (demo-only), the real editor must never manufacture
 * a demo session that was never actually visited.
 */
export function peekDemoSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(DEMO_SESSION_KEY);
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

/**
 * The demo draft buffer's shape, loosely typed (block/brandKit/etc. content is
 * opaque Puck/page-builder data this module deliberately doesn't depend on).
 * Structurally identical to EditorShell's own PortfolioBrowserDraft.
 */
export type DemoDraftBuffer = {
  version: number;
  data: { home: unknown; gallery: unknown };
  brandKit: unknown;
  contact: unknown;
  formLocale: string;
  formDir: string;
  headerConfig: unknown;
  collectionsPopup: unknown;
  draftId: string | null;
  draftName: string;
};

/**
 * Reads a demo session's saved draft buffer, or null if none exists / it
 * fails to parse / it's an unrecognized version. Used by the real (signed-in)
 * editor to detect leftover demo work worth offering to import.
 */
// Must match EditorShell.tsx's LOCAL_DRAFT_VERSION — the real and demo draft
// buffers share the exact same localStorage format (only the key differs).
const LOCAL_DRAFT_BUFFER_VERSION = 2;

export function readDemoDraftBuffer(sessionId: string): DemoDraftBuffer | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(demoDraftKey(sessionId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DemoDraftBuffer>;
    if (parsed.version !== LOCAL_DRAFT_BUFFER_VERSION || !parsed.data) return null;
    return parsed as DemoDraftBuffer;
  } catch {
    return null;
  }
}

/**
 * Wipes every localStorage key a demo session owns — draft buffer, uploaded-
 * image library, and the session id itself. Called from BOTH the "Yes" and
 * "No, discard" paths of the real editor's demo-import confirmation so it can
 * never show again for this session, regardless of which path was taken.
 */
export function wipeDemoLocalStorage(sessionId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(demoDraftKey(sessionId));
  window.localStorage.removeItem(demoImageLibraryKey(sessionId));
  window.localStorage.removeItem(DEMO_SESSION_KEY);
}

// Must match DEMO_IMPORT_COOKIE in lib/auth/demoImportMarker.ts — do not
// change independently of that constant.
const DEMO_IMPORT_COOKIE = "gw_demo_import";
const DEMO_IMPORT_COOKIE_MAX_AGE = 60 * 60 * 2; // 2 hours — covers onboarding

/**
 * Marks "this authentication came from the Portfolio Maker demo" so the redirect
 * after onboarding lands on the real editor instead of the dashboard (see
 * lib/auth/demoImportMarker.ts). Set client-side on the demo's sign-up CTA
 * click — a plain (non-httpOnly) cookie is fine here since the marker only
 * steers a redirect, and it survives the WorkOS OAuth round trip the same way
 * an httpOnly one would (sameSite=lax + path=/, not httpOnly, governs
 * cross-request survival).
 */
export function markDemoSignupIntent(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DEMO_IMPORT_COOKIE}=1; path=/; max-age=${DEMO_IMPORT_COOKIE_MAX_AGE}; samesite=lax`;
}

/** Clears a demo handoff that the visitor explicitly chose to discard. */
export function clearDemoSignupIntent(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${DEMO_IMPORT_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

/**
 * Convenience lookup for the real editor: is there a demo session with an
 * actual saved buffer worth offering to import? Collapses the peek + read
 * two-step into one null-safe check.
 */
export function detectImportableDemoSession(): { sessionId: string; buffer: DemoDraftBuffer } | null {
  const sessionId = peekDemoSessionId();
  if (!sessionId) return null;
  const buffer = readDemoDraftBuffer(sessionId);
  if (!buffer) return null;
  return { sessionId, buffer };
}
