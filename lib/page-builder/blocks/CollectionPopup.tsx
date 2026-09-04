"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import type { PortfolioCollectionsPopupConfig, BrandKitRadius } from "@/lib/page-builder/types";
import { resolvePopupLayout, resolveImageModalLayout } from "@/lib/page-builder/types";
import { CollectionPopupChrome } from "./CollectionPopupChrome";
import { applyCollectionPopupDefaults, type CollectionPopupLabels } from "@/lib/page-builder/blockContext";
import { Lightbox, type LightboxImage } from "./Lightbox";
import { ContactSheet, Justified, SplitIndex, Immersive, type PopupLayoutBodyProps } from "./popupLayouts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CollectionPopupProps = {
  collectionId: string;
  collectionName: string;
  mode: "owner" | "public";
  slug?: string; // required when mode === "public"
  popupConfig: PortfolioCollectionsPopupConfig;
  open: boolean;
  onClose: () => void;
  /** Localized strings; falls back to English literals when absent (editor canvas). */
  labels?: CollectionPopupLabels;
  /** Brand-kit CSS vars (--pf-color-*, --pf-font-*, --pf-radius). The popup
   *  renders through a Portal at document.body, escaping the page wrapper that
   *  sets these — so we re-apply them here or the popup has no background. */
  brandVars?: Record<string, string>;
};

type PopupImage = LightboxImage;

type FetchState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "populated"; images: PopupImage[]; nextCursor: string | null; loadMoreError: boolean; total?: number }
  | { status: "loadingMore"; images: PopupImage[]; nextCursor: string; total?: number }
  | { status: "empty" };

// ---------------------------------------------------------------------------
// Radius scale (mirrors CollectionsPopupPanelDialog)
// ---------------------------------------------------------------------------

const RADIUS_PX: Record<BrandKitRadius, string> = {
  sharp: "0",
  subtle: "0.25rem",
  rounded: "0.5rem",
};

const BRAND_KIT_RADII_SET = new Set<string>(["sharp", "subtle", "rounded"]);

/** Layouts that need the wider 1080px shell (justified rows, split-index masonry). */
const WIDE_SHELL_LAYOUTS = new Set(["justified", "split-index"]);

// ---------------------------------------------------------------------------
// Color resolver — resolves token name or hex to a CSS color value.
// Mirrors the resolveColorValue in CollectionsPopupPanelDialog.
// ---------------------------------------------------------------------------

const TOKEN_TO_CSS_VAR: Record<string, string> = {
  primary: "var(--pf-color-primary)",
  secondary: "var(--pf-color-secondary)",
  accent: "var(--pf-color-accent)",
  background: "var(--pf-color-bg)",
  foreground: "var(--pf-color-fg)",
};

function resolveColorValue(token: string | undefined): string | undefined {
  if (!token) return undefined;
  if (token.startsWith("#")) return token;
  if (TOKEN_TO_CSS_VAR[token]) return TOKEN_TO_CSS_VAR[token];
  return token;
}

// ---------------------------------------------------------------------------
// URL builder
// ---------------------------------------------------------------------------

const PAGE_LIMIT = 24;

function buildUrl(
  mode: "owner" | "public",
  collectionId: string,
  slug: string | undefined,
  cursor: string | null
): string {
  const base =
    mode === "owner"
      ? `/api/portfolio/gallery/collections/${collectionId}`
      : `/api/public/w/${slug}/collections/${collectionId}`;
  const params = new URLSearchParams({ limit: String(PAGE_LIMIT) });
  if (cursor) params.set("cursor", cursor);
  return `${base}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Normalize API response items → PopupImage
// `alt` is the a11y string only — the server always resolves it
// (altText || caption || ""); it is never backfilled from `caption` here,
// since `caption` is now a distinct, separately-rendered description field.
// ---------------------------------------------------------------------------

function normalizeItem(item: {
  id: string;
  publicId: string;
  alt?: string;
  title?: string;
  caption?: string;
  date?: string;
  location?: string;
  client?: string;
  meta?: { label: string; value: string }[];
  tags?: string[];
  width?: number;
  height?: number;
}): PopupImage {
  return {
    id: item.id,
    publicId: item.publicId,
    alt: item.alt ?? "",
    title: item.title,
    caption: item.caption,
    date: item.date,
    location: item.location,
    client: item.client,
    meta: item.meta,
    tags: item.tags,
    width: item.width,
    height: item.height,
  };
}

// ---------------------------------------------------------------------------
// Scoped focus-visible styles for inline-styled interactive controls
// ---------------------------------------------------------------------------

const FOCUS_VISIBLE_STYLES = `
[data-popup-close]:focus-visible,
[data-popup-thumb]:focus-visible {
  outline: 2px solid var(--pf-color-fg, #111);
  outline-offset: 2px;
}
`;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CollectionPopup({
  collectionId,
  collectionName,
  mode,
  slug,
  popupConfig,
  open,
  onClose,
  labels: labelsProp,
  brandVars,
}: CollectionPopupProps) {
  const L = applyCollectionPopupDefaults(labelsProp);
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const layout = resolvePopupLayout(popupConfig.popupLayout);
  const isImmersive = layout === "immersive";
  const shellMaxWidth = WIDE_SHELL_LAYOUTS.has(layout) ? 1080 : 900;

  // Resolved popup styles
  const bg = resolveColorValue(popupConfig.backgroundColor);
  const borderColor = resolveColorValue(popupConfig.borderColor);
  const borderWidth = popupConfig.borderWidth ?? 0;
  const radiusKey =
    popupConfig.radius &&
    BRAND_KIT_RADII_SET.has(popupConfig.radius)
      ? (popupConfig.radius as BrandKitRadius)
      : null;
  const borderRadius = radiusKey ? RADIUS_PX[radiusKey] : "var(--pf-radius)";

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  const fetchPage = useCallback(
    async (cursor: string | null, appendTo?: PopupImage[], priorTotal?: number) => {
      const url = buildUrl(mode, collectionId, slug, cursor);
      const isAppending = appendTo !== undefined;

      if (!isAppending) {
        setState({ status: "loading" });
      } else {
        setState({
          status: "loadingMore",
          images: appendTo,
          nextCursor: cursor as string,
          total: priorTotal,
        });
      }

      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          items: Array<{
            id: string;
            publicId: string;
            alt?: string;
            title?: string;
            caption?: string;
            date?: string;
            location?: string;
            client?: string;
            meta?: { label: string; value: string }[];
            tags?: string[];
            width?: number;
            height?: number;
          }>;
          nextCursor: string | null;
          total?: number;
        };
        const normalized = data.items.map(normalizeItem);
        const merged = appendTo ? [...appendTo, ...normalized] : normalized;
        const resolvedTotal = data.total ?? priorTotal;
        if (merged.length === 0 && !data.nextCursor) {
          setState({ status: "empty" });
        } else {
          setState({
            status: "populated",
            images: merged,
            nextCursor: data.nextCursor,
            loadMoreError: false,
            total: resolvedTotal,
          });
        }
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.error("CollectionPopup fetch failed", err);
        }
        if (isAppending && appendTo) {
          // Keep existing images; show inline load-more error
          setState((prev) => {
            if (prev.status === "loadingMore") {
              return {
                status: "populated",
                images: prev.images,
                nextCursor: prev.nextCursor,
                loadMoreError: true,
                total: prev.total,
              };
            }
            return {
              status: "populated",
              images: appendTo,
              nextCursor: cursor as string,
              loadMoreError: true,
              total: priorTotal,
            };
          });
        } else {
          setState({ status: "error", message: L.failed });
        }
      }
    },
    [mode, collectionId, slug, L.failed]
  );

  // Fetch on open. Closed state is rendered as idle, so no reset is needed here.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- opening the dialog intentionally flips local fetch state before the async request resolves.
      void fetchPage(null);
    }
  }, [open, fetchPage]);

  const handleLoadMore = useCallback(() => {
    if (state.status === "populated" && state.nextCursor) {
      void fetchPage(state.nextCursor, state.images, state.total);
    }
  }, [state, fetchPage]);

  // ---------------------------------------------------------------------------
  // Derived body props — every non-immersive layout receives the same shape.
  // ---------------------------------------------------------------------------

  const loadedImages =
    state.status === "populated" || state.status === "loadingMore" ? state.images : [];
  const total = state.status === "populated" || state.status === "loadingMore" ? state.total : undefined;
  const hasMore = state.status === "populated" && state.nextCursor != null;
  const isLoadingMore = state.status === "loadingMore";
  const loadMoreError = state.status === "populated" && state.loadMoreError;

  const bodyProps: PopupLayoutBodyProps = {
    images: loadedImages,
    collectionName,
    // TODO(collection-description): thread the collection's `description`
    // once GET /api/portfolio/gallery/collections/[id] and
    // GET /api/public/w/[slug]/collections/[id] return it at the top level
    // (currently only PATCH echoes it back) — see Backend handoff.
    collectionDescription: undefined,
    total,
    hasMore,
    isLoadingMore,
    loadMoreError,
    onLoadMore: handleLoadMore,
    onOpen: (index) => setOpenIndex(index),
    labels: L,
  };

  // ---------------------------------------------------------------------------
  // Popup shell styles
  // ---------------------------------------------------------------------------

  const shellStyle: React.CSSProperties = isImmersive
    ? {
        // Re-apply brand vars: the Portal escapes the page wrapper that sets them.
        ...(brandVars as React.CSSProperties),
        position: "fixed",
        inset: 0,
        zIndex: 100,
      }
    : {
        // Re-apply brand vars: the Portal escapes the page wrapper that sets them.
        ...(brandVars as React.CSSProperties),
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
        maxHeight: "90vh",
        minWidth: "90vw",
        maxWidth: `${shellMaxWidth}px`,
        width: "90vw",
        backgroundColor: bg ?? "var(--pf-color-bg)",
        borderWidth: borderWidth > 0 ? `${borderWidth}px` : "1px",
        borderStyle: "solid",
        borderColor:
          borderWidth > 0 && borderColor
            ? borderColor
            : "color-mix(in srgb, var(--pf-color-fg, #111) 14%, transparent)",
        borderRadius,
        fontFamily: "var(--pf-font-body)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <DialogPrimitive.Root
        open={open}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Backdrop
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 50,
              background: "rgba(0,0,0,0.5)",
            }}
          />
          <DialogPrimitive.Popup
            data-popup-shell=""
            aria-label={collectionName}
            style={shellStyle}
          >
            {/* Scoped focus-visible styles for inline-styled interactive controls */}
            <style>{FOCUS_VISIBLE_STYLES}</style>

            {isImmersive ? (
              <Immersive
                status={state.status}
                images={loadedImages}
                collectionName={collectionName}
                hasMore={hasMore}
                onLoadMore={handleLoadMore}
                onRetry={() => fetchPage(null)}
                onClose={onClose}
                labels={L}
              />
            ) : (
              <CollectionPopupChrome
                collectionName={collectionName}
                config={popupConfig}
                onClose={onClose}
                closeDataAttr="data-popup-close"
                noShell
                maxWidth={shellMaxWidth}
              >
              {/* Scrollable body */}
              <div
                style={{
                  overflowY: "auto",
                  flex: 1,
                  padding: "16px",
                }}
              >
                {state.status === "idle" || state.status === "loading" ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "48px",
                      gap: "8px",
                      color: "var(--pf-color-fg, #111)",
                    }}
                  >
                    <Loader2Icon
                      aria-hidden
                      style={{
                        width: "20px",
                        height: "20px",
                        animation: "spin 1s linear infinite",
                      }}
                    />
                    <span>{L.loading}</span>
                  </div>
                ) : state.status === "error" ? (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "12px",
                      padding: "48px",
                      textAlign: "center",
                      color: "var(--pf-color-fg, #111)",
                    }}
                  >
                    <p style={{ margin: 0 }}>{L.failed}</p>
                    <button
                      type="button"
                      onClick={() => fetchPage(null)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "8px 16px",
                        border: "1px solid currentColor",
                        borderRadius: "4px",
                        background: "transparent",
                        color: "inherit",
                        cursor: "pointer",
                        fontSize: "0.875rem",
                      }}
                    >
                      <RefreshCwIcon aria-hidden style={{ width: "14px", height: "14px" }} />
                      {L.retry}
                    </button>
                  </div>
                ) : state.status === "empty" ? (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "48px",
                      color: "color-mix(in srgb, var(--pf-color-fg, #111) 62%, transparent)",
                      fontSize: "0.875rem",
                    }}
                  >
                    {L.empty}
                  </div>
                ) : layout === "justified" ? (
                  <Justified {...bodyProps} />
                ) : layout === "split-index" ? (
                  <SplitIndex {...bodyProps} />
                ) : (
                  <ContactSheet {...bodyProps} />
                )}
              </div>
              </CollectionPopupChrome>
            )}
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Nested lightbox — contact-sheet/justified/split-index only. Immersive
       *  has no second modal by design (see popupLayouts/Immersive.tsx).
       *  `openIndex` is a position within the currently loaded `images` array;
       *  `onRequestMore` bridges into the same cursor-paging fetch as the
       *  body's "Load more" so navigating past the loaded end still pages. */}
      {open && !isImmersive && openIndex != null && loadedImages.length > 0 && (
        <Lightbox
          images={loadedImages}
          initialIndex={openIndex}
          onClose={() => setOpenIndex(null)}
          layout={resolveImageModalLayout(popupConfig.imageModalLayout)}
          total={total}
          hasMore={hasMore}
          onRequestMore={handleLoadMore}
          closeLabel={L.close}
          fullSizeAlt={L.fullSizeAlt}
        />
      )}
    </>
  );
}
