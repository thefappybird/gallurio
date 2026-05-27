/**
 * Server-only context for portfolio page rendering.
 *
 * Design: the renderer page (app/(public)/w/[orgSlug]/page.tsx) wraps the
 * <Render> call in `runWithRenderWorkspace(workspace, () => <Render ... />)`,
 * and server blocks call `getRenderWorkspace()` or `getRenderWorkspaceIdOrThrow()`
 * to access tenant context.
 *
 * Implementation: AsyncLocalStorage from node:async_hooks provides true
 * per-request isolation. Module-level mutable state is shared across all
 * concurrent requests in the same Node process; AsyncLocalStorage propagates
 * correctly across awaits and concurrent requests cannot clobber each other's
 * workspace context — eliminating the cross-tenant data leak risk of the
 * previous singleton approach.
 *
 * In Vitest (happy-dom), AsyncLocalStorage works synchronously within the
 * same execution context. Tests wrap renders in `runWithRenderWorkspace` the
 * same way production code does.
 */

import { AsyncLocalStorage } from "node:async_hooks";

// ---------------------------------------------------------------------------
// Minimal workspace shape needed by server-rendered blocks
// ---------------------------------------------------------------------------

export type RenderWorkspace = {
  _id: string | { toString(): string };
  name: string;
  branding?: {
    logoUrl?: string | null;
    tagline?: string | null;
    description?: string | null;
  } | null;
  publicPage?: {
    inquiryRecipientEmail?: string | null;
  } | null;
  /** Workspace contact details used by ContactCardBlock */
  contact?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    socials?: {
      instagram?: string | null;
      facebook?: string | null;
      tiktok?: string | null;
      website?: string | null;
    } | null;
  } | null;
};

// ---------------------------------------------------------------------------
// AsyncLocalStorage store
// ---------------------------------------------------------------------------

const storage = new AsyncLocalStorage<RenderWorkspace>();

// ---------------------------------------------------------------------------
// Exported API
// ---------------------------------------------------------------------------

/**
 * Runs `fn` with `ws` available to all synchronous and asynchronous
 * descendants via `getRenderWorkspace()`. Each concurrent request gets its
 * own isolated store — no cross-request clobbering.
 *
 * Usage in the renderer page:
 *   return runWithRenderWorkspace(workspace, () => (
 *     <Render data={homeData} config={puckConfig} />
 *   ));
 */
export function runWithRenderWorkspace<T>(ws: RenderWorkspace, fn: () => T): T {
  return storage.run(ws, fn);
}

/**
 * Returns the currently active workspace, or null if called outside of a
 * `runWithRenderWorkspace` context.
 */
export function getRenderWorkspace(): RenderWorkspace | null {
  return storage.getStore() ?? null;
}

/**
 * Returns the `_id` of the active workspace as a plain string.
 *
 * Throws if called outside a workspace render context (i.e., without first
 * wrapping the render in `runWithRenderWorkspace`). This is a programming error.
 */
export function getRenderWorkspaceIdOrThrow(): string {
  const ws = getRenderWorkspace();
  if (!ws) {
    throw new Error(
      "Portfolio block rendered outside of a workspace render context. " +
        "Wrap the render in runWithRenderWorkspace(workspace, () => ...) " +
        "in app/(public)/w/[orgSlug]/page.tsx before invoking <Render>."
    );
  }
  return String(ws._id);
}
