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
  /** BCP-47 locale derived from workspace.country (en|fil|ms|id|th). Set by the page boundary, not the helper. */
  locale?: string;
  /**
   * Pre-resolved chrome strings for the public page. Set by the page boundary after
   * calling getTranslations(). The `startingFrom` value is an ICU template with the
   * literal "{price}" token preserved for per-item substitution in ServicesListBlock.
   */
  chrome?: { startingFrom?: string } | null;
};

// ---------------------------------------------------------------------------
// Workspace mapping helper
// ---------------------------------------------------------------------------

/**
 * Maps a lean Workspace Mongoose doc into the minimal `RenderWorkspace` shape.
 *
 * Regression-proofing for finding #1: this helper is the canonical place that
 * copies `contact` (and all other fields) from the DB doc into the render context,
 * ensuring no field is silently omitted at the page boundary.
 *
 * NOTE: `locale` and `chrome` are intentionally NOT set here — they require an
 * async `getTranslations()` call that only the server page boundary can make.
 */
export function buildRenderWorkspace(workspace: {
  _id: unknown;
  name: string;
  branding?: { logoUrl?: string | null; tagline?: string | null; description?: string | null } | null;
  publicPage?: { inquiryRecipientEmail?: string | null } | null;
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
}): RenderWorkspace {
  return {
    _id: String(workspace._id),
    name: workspace.name,
    branding: workspace.branding
      ? {
          logoUrl: workspace.branding.logoUrl ?? null,
          tagline: workspace.branding.tagline ?? null,
          description: workspace.branding.description ?? null,
        }
      : null,
    publicPage: workspace.publicPage
      ? { inquiryRecipientEmail: workspace.publicPage.inquiryRecipientEmail ?? null }
      : null,
    contact: workspace.contact
      ? {
          email: workspace.contact.email ?? null,
          phone: workspace.contact.phone ?? null,
          address: workspace.contact.address ?? null,
          socials: workspace.contact.socials
            ? {
                instagram: workspace.contact.socials.instagram ?? null,
                facebook: workspace.contact.socials.facebook ?? null,
                tiktok: workspace.contact.socials.tiktok ?? null,
                website: workspace.contact.socials.website ?? null,
              }
            : null,
        }
      : null,
  };
}

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
