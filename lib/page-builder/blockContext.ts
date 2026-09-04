/**
 * Client-safe (universal) Puck context readers for gallery blocks.
 *
 * This module is intentionally free of `node:async_hooks`, `server-only`, and
 * `"use client"` — it may be imported by both Server Components and client
 * components without pulling the AsyncLocalStorage into the client bundle.
 *
 * Server-only utilities (ALS store, runWithRenderWorkspace, etc.) live in
 * `lib/page-builder/serverContext.tsx` and re-export the types defined here.
 */

import type { PortfolioCollectionsPopupConfig } from "@/lib/page-builder/types";

// ---------------------------------------------------------------------------
// Minimal workspace shape needed by server-rendered blocks
// ---------------------------------------------------------------------------

export type RenderWorkspace = {
  _id: string | { toString(): string };
  name: string;
  /** Workspace slug — used to build public links (e.g. the Gallery page) inside blocks. */
  slug?: string;
  publicPage?: {
    inquiryRecipientEmail?: string | null;
    collectionsPopup?: PortfolioCollectionsPopupConfig | null;
  } | null;
  /** True when rendered inside the editor canvas / chrome-less preview (owner context). */
  editorPreview?: boolean;
  /**
   * Brand-kit CSS custom properties (--pf-color-*, --pf-font-*, --pf-radius).
   * Blocks that portal content to `document.body` (base-ui Dialog/Popover)
   * escape the page wrapper that normally declares these — re-apply this map
   * as an inline style on the portaled root or `var(--pf-color-x)` resolves
   * to nothing. See CollectionPopup's use of this field.
   */
  brandVars?: Record<string, string>;
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
  /** BCP-47 locale derived from workspace.country or stored form locale (en|fil|ms|id). Set by the page boundary, not the helper. */
  locale?: string;
  /**
   * Pre-resolved chrome strings for the public page. Set by the page boundary after
   * calling getTranslations(). The `startingFrom` value is an ICU template with the
   * literal "{price}" token preserved for per-item substitution in ServicesListBlock.
   * `gallery` holds the localized empty/error/carousel strings for the gallery blocks.
   * `socialLinkConfirm` is an ICU template with the literal "{url}" token preserved
   * for per-link substitution in SocialIconLink — shown in window.confirm on click.
   */
  chrome?: {
    startingFrom?: string;
    gallery?: GalleryChromeLabels;
    /** Localized strings consumed by the Navigation block (resolved at the page boundary). */
    nav?: NavChromeLabels;
    /** External-link confirm template. Contains literal "{url}" for per-link substitution. */
    socialLinkConfirm?: string;
  } | null;
  /**
   * Preview-scoped nav overrides — set ONLY by `app/[locale]/portfolio-preview/page.tsx`
   * so the Navigation block's Home/Gallery links stay inside the preview iframe instead
   * of navigating to the live public site, and active-link highlighting resolves against
   * the iframe's own zone param (there is no real per-zone pathname there). Absent on the
   * live public page and the editor canvas — NavigationBlock falls back to
   * `portfolioHomePath`/`portfolioGalleryPath` and `usePathname()` in both cases.
   */
  previewNav?: {
    homeHref?: string;
    galleryHref?: string;
    /** Which of homeHref/galleryHref is "current" for this preview render. */
    activePath?: string;
  } | null;
};

/** Localized strings consumed by the gallery blocks (resolved at the page boundary). */
export type GalleryChromeLabels = {
  empty?: string;
  noCollection?: string;
  unavailable?: string;
  error?: string;
  featuredEmpty?: string;
  carouselHint?: string;
  carouselPrev?: string;
  carouselNext?: string;
};

/** Localized strings consumed by the Navigation block (resolved at the page boundary). */
export type NavChromeLabels = {
  navLandmark?: string;
  home?: string;
  gallery?: string;
  contact?: string;
  openMenu?: string;
  closeMenu?: string;
};

/** Localized strings consumed by the collection popup (resolved at the page boundary). */
export type CollectionPopupLabels = {
  close?: string;
  loading?: string;
  failed?: string;
  retry?: string;
  empty?: string;
  fullSizeAlt?: string;
  /** Aria-label fallback for a thumbnail button whose image has no alt text. */
  openPhoto?: string;
  /** Fallback word for a missing alt/placeholder ("Photo"). */
  photo?: string;
  loadMore?: string;
  loadingMore?: string;
  loadMoreFailed?: string;
  photoCountOne?: string;
  /** Contains the literal placeholder "{count}", swapped in by the caller. */
  photoCountOther?: string;
  previousPhoto?: string;
  nextPhoto?: string;
  filmstripLabel?: string;
};

/**
 * Applies English fallbacks for every collection popup label.
 * Pure function — no ALS, no server-only imports.
 */
export function applyCollectionPopupDefaults(l: CollectionPopupLabels = {}): Required<CollectionPopupLabels> {
  return {
    close: l.close ?? "Close",
    loading: l.loading ?? "Loading...",
    failed: l.failed ?? "Failed to load photos.",
    retry: l.retry ?? "Retry",
    empty: l.empty ?? "No photos in this collection yet.",
    fullSizeAlt: l.fullSizeAlt ?? "Full size photo",
    openPhoto: l.openPhoto ?? "Open photo",
    photo: l.photo ?? "Photo",
    loadMore: l.loadMore ?? "Load more",
    loadingMore: l.loadingMore ?? "Loading more...",
    loadMoreFailed: l.loadMoreFailed ?? "Failed to load more photos.",
    photoCountOne: l.photoCountOne ?? "1 photo",
    photoCountOther: l.photoCountOther ?? "{count} photos",
    previousPhoto: l.previousPhoto ?? "Previous photo",
    nextPhoto: l.nextPhoto ?? "Next photo",
    filmstripLabel: l.filmstripLabel ?? "Photo filmstrip",
  };
}

// ---------------------------------------------------------------------------
// Puck metadata bridge (universal)
// ---------------------------------------------------------------------------

/**
 * Shape of the `metadata` object passed to `<Render metadata={...}>` (and
 * `<Puck>`), which Puck forwards to every block as `props.puck.metadata`.
 */
export type PortfolioRenderMetadata = {
  workspace?: RenderWorkspace;
  collectionPopupLabels?: CollectionPopupLabels;
  /** Decorative sample media may replace empty states inside the drawer's
   * insertion preview. Never set on the editor canvas or public renderer. */
  presetPreview?: boolean;
};

/** The `puck` prop Puck injects into every rendered component. */
export type BlockPuck = {
  metadata?: PortfolioRenderMetadata;
  /** Ref callback from Puck for inline components (`inline: true`). Attach to the
   *  block's root element so Puck can make it draggable without its own wrapper. */
  dragRef?: ((element: Element | null) => void) | null;
  /** True when the block is rendering inside the Puck editor canvas (not in the
   *  public `<Render>` output). Puck sets this automatically — blocks can use it
   *  to diverge editor-only appearance (e.g. show real column count in a narrow
   *  canvas) without affecting the published page. */
  isEditing?: boolean;
};

// ---------------------------------------------------------------------------
// Client-safe chrome helpers
// ---------------------------------------------------------------------------

/**
 * Applies the English fallback for every gallery chrome label.
 * Pure function — no ALS, no server-only imports.
 */
export function applyGalleryChromeDefaults(g: GalleryChromeLabels = {}): Required<GalleryChromeLabels> {
  return {
    empty: g.empty ?? "No photos in this collection yet.",
    noCollection: g.noCollection ?? "No collection selected.",
    unavailable: g.unavailable ?? "Gallery not available.",
    error: g.error ?? "Gallery temporarily unavailable.",
    featuredEmpty: g.featuredEmpty ?? "No featured photos selected yet.",
    carouselHint: g.carouselHint ?? "Swipe or use the arrows to browse",
    carouselPrev: g.carouselPrev ?? "Previous image",
    carouselNext: g.carouselNext ?? "Next image",
  };
}

/**
 * Client-safe: localized gallery chrome labels from Puck `metadata` (no ALS).
 *
 * Reads `puck.metadata.workspace.chrome.gallery` and fills every missing key
 * with an English default. Safe to import in client components because it never
 * touches AsyncLocalStorage.
 */
export function getGalleryChromeLabelsFrom(puck?: BlockPuck | null): Required<GalleryChromeLabels> {
  return applyGalleryChromeDefaults(puck?.metadata?.workspace?.chrome?.gallery ?? {});
}

/**
 * Applies the English fallback for every nav chrome label.
 * Pure function — no ALS, no server-only imports.
 */
export function applyNavChromeDefaults(n: NavChromeLabels = {}): Required<NavChromeLabels> {
  return {
    navLandmark: n.navLandmark ?? "Portfolio",
    home: n.home ?? "Home",
    gallery: n.gallery ?? "Gallery",
    contact: n.contact ?? "Contact",
    openMenu: n.openMenu ?? "Open menu",
    closeMenu: n.closeMenu ?? "Close menu",
  };
}

/**
 * Client-safe: localized nav chrome labels from Puck `metadata` (no ALS).
 *
 * Reads `puck.metadata.workspace.chrome.nav` and fills every missing key
 * with an English default. Safe to import in client components because it never
 * touches AsyncLocalStorage.
 */
export function getNavChromeLabelsFrom(puck?: BlockPuck | null): Required<NavChromeLabels> {
  return applyNavChromeDefaults(puck?.metadata?.workspace?.chrome?.nav ?? {});
}

/**
 * Client-safe: the active workspace from Puck `metadata` (no ALS).
 *
 * Every real render path threads the workspace through Puck `metadata.workspace`
 * (see app/(public)/w/[orgSlug]/page.tsx, the gallery page, and the portfolio
 * preview), so data blocks can read it without importing the server-only
 * AsyncLocalStorage store from serverContext.tsx. Returns null when no workspace
 * is present (e.g. an isolated unit render without metadata).
 */
export function getRenderWorkspaceFrom(puck?: BlockPuck | null): RenderWorkspace | null {
  return puck?.metadata?.workspace ?? null;
}

/**
 * Client-safe: the preview-scoped nav override from Puck `metadata` (no ALS).
 *
 * Reads `puck.metadata.workspace.previewNav`. Returns null everywhere the
 * override is absent (live public page, editor canvas) — callers fall back
 * to the live public paths in that case.
 */
export function getPreviewNavFrom(puck?: BlockPuck | null): RenderWorkspace["previewNav"] | null {
  return puck?.metadata?.workspace?.previewNav ?? null;
}
