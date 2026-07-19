"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import type { PortfolioCollectionsPopupConfig, BrandKitRadius } from "@/lib/page-builder/types";
import { CollectionPopupChrome } from "./CollectionPopupChrome";
import { applyCollectionPopupDefaults, type CollectionPopupLabels } from "@/lib/page-builder/blockContext";
import { Lightbox, type LightboxImage } from "./Lightbox";

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
  | { status: "populated"; images: PopupImage[]; nextCursor: string | null; loadMoreError: boolean }
  | { status: "loadingMore"; images: PopupImage[]; nextCursor: string }
  | { status: "empty" };

// ---------------------------------------------------------------------------
// Radius scale (mirrors CollectionsPopupPanelDialog)
// ---------------------------------------------------------------------------

const RADIUS_PX: Record<BrandKitRadius, string> = {
  sharp: "0px",
  subtle: "6px",
  rounded: "16px",
};

const BRAND_KIT_RADII_SET = new Set<string>(["sharp", "subtle", "rounded"]);

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
// Owner items may have `caption` instead of `alt`.
// ---------------------------------------------------------------------------

function normalizeItem(item: {
  id: string;
  publicId: string;
  alt?: string;
  caption?: string;
}): PopupImage {
  return {
    id: item.id,
    publicId: item.publicId,
    alt: item.alt ?? item.caption ?? "",
  };
}

// ---------------------------------------------------------------------------
// Scoped focus-visible styles for inline-styled interactive controls
// ---------------------------------------------------------------------------

const FOCUS_VISIBLE_STYLES = `
[data-popup-close]:focus-visible,
[data-popup-thumb]:focus-visible {
  outline: 2px solid var(--pf-color-foreground, #111);
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
  const [lightboxImage, setLightboxImage] = useState<PopupImage | null>(null);

  // Resolved popup styles
  const bg = resolveColorValue(popupConfig.backgroundColor);
  const borderColor = resolveColorValue(popupConfig.borderColor);
  const borderWidth = popupConfig.borderWidth ?? 0;
  const radiusKey =
    popupConfig.radius &&
    BRAND_KIT_RADII_SET.has(popupConfig.radius)
      ? (popupConfig.radius as BrandKitRadius)
      : null;
  const borderRadius = radiusKey ? RADIUS_PX[radiusKey] : "0px";

  // ---------------------------------------------------------------------------
  // Fetch helpers
  // ---------------------------------------------------------------------------

  const fetchPage = useCallback(
    async (cursor: string | null, appendTo?: PopupImage[]) => {
      const url = buildUrl(mode, collectionId, slug, cursor);
      const isAppending = appendTo !== undefined;

      if (!isAppending) {
        setState({ status: "loading" });
      } else {
        setState({
          status: "loadingMore",
          images: appendTo,
          nextCursor: cursor as string,
        });
      }

      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = (await res.json()) as {
          items: Array<{ id: string; publicId: string; alt?: string; caption?: string }>;
          nextCursor: string | null;
        };
        const normalized = data.items.map(normalizeItem);
        const merged = appendTo ? [...appendTo, ...normalized] : normalized;
        if (merged.length === 0 && !data.nextCursor) {
          setState({ status: "empty" });
        } else {
          setState({
            status: "populated",
            images: merged,
            nextCursor: data.nextCursor,
            loadMoreError: false,
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
              };
            }
            return {
              status: "populated",
              images: appendTo,
              nextCursor: cursor as string,
              loadMoreError: true,
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

  // ---------------------------------------------------------------------------
  // Popup shell styles
  // ---------------------------------------------------------------------------

  const shellStyle: React.CSSProperties = {
    // Re-apply brand vars: the Portal escapes the page wrapper that sets them.
    ...(brandVars as React.CSSProperties),
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 100,
    maxHeight: "90vh",
    minWidth: "90vw",
    maxWidth: "900px",
    width: "90vw",
    backgroundColor: bg ?? "var(--pf-color-bg)",
    borderWidth: borderWidth > 0 ? `${borderWidth}px` : "1px",
    borderStyle: "solid",
    borderColor:
      borderWidth > 0 && borderColor
        ? borderColor
        : "var(--pf-color-border, rgba(0,0,0,0.12))",
    borderRadius,
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

            <CollectionPopupChrome
              collectionName={collectionName}
              config={popupConfig}
              onClose={onClose}
              closeDataAttr="data-popup-close"
              noShell
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
                    color: "var(--pf-color-foreground, #111)",
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
                    color: "var(--pf-color-foreground, #111)",
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
                    color: "var(--pf-color-foreground, #888)",
                    fontSize: "0.875rem",
                  }}
                >
                  {L.empty}
                </div>
              ) : (
                /* populated or loadingMore */
                <>
                  {/* Image grid, roughly six per row, reflowing on smaller screens */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    {state.images.map((img) => {
                      const thumbSrc = imageDeliveryUrl(img.publicId, {
                        width: 400,
                        height: 400,
                        fit: "cover",
                      });
                      return (
                        <button
                          key={img.id}
                          type="button"
                          aria-label={img.alt || "Open photo"}
                          data-popup-thumb=""
                          onClick={() => setLightboxImage(img)}
                          style={{
                            flex: "0 0 calc(100% / 6 - 7px)",
                            minWidth: "120px",
                            aspectRatio: "1 / 1",
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            cursor: "pointer",
                            overflow: "hidden",
                            display: "block",
                          }}
                        >
                          {thumbSrc ? (
                            <img
                              src={thumbSrc}
                              alt={img.alt}
                              style={{
                                width: "100%",
                                height: "100%",
                                objectFit: "cover",
                                display: "block",
                                transition: "opacity 0.15s",
                              }}
                              onMouseEnter={(e) => {
                                (e.currentTarget as HTMLImageElement).style.opacity = "0.85";
                              }}
                              onMouseLeave={(e) => {
                                (e.currentTarget as HTMLImageElement).style.opacity = "1";
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                background: "var(--pf-color-muted, #f0f0f0)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.75rem",
                                color: "#888",
                              }}
                            >
                              {img.alt || "Photo"}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Load more / loading more / inline load-more error */}
                  {state.status === "populated" && state.nextCursor && !state.loadMoreError ? (
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "center",
                        padding: "24px 0 8px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          fetchPage(
                            (state as { status: "populated"; images: PopupImage[]; nextCursor: string }).nextCursor,
                            state.images
                          )
                        }
                        style={{
                          padding: "8px 24px",
                          border: "1px solid var(--pf-color-foreground, #111)",
                          borderRadius: "4px",
                          background: "transparent",
                          color: "var(--pf-color-foreground, #111)",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                        }}
                      >
                        Load more
                      </button>
                    </div>
                  ) : state.status === "populated" && state.loadMoreError ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "8px",
                        padding: "16px 0 8px",
                        textAlign: "center",
                        color: "var(--pf-color-foreground, #111)",
                        fontSize: "0.875rem",
                      }}
                    >
                      <span>Failed to load more photos.</span>
                      <button
                        type="button"
                        data-testid="load-more-retry"
                        onClick={() =>
                          fetchPage(
                            (state as { status: "populated"; images: PopupImage[]; nextCursor: string | null }).nextCursor,
                            state.images
                          )
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 14px",
                          border: "1px solid currentColor",
                          borderRadius: "4px",
                          background: "transparent",
                          color: "inherit",
                          cursor: "pointer",
                          fontSize: "0.875rem",
                        }}
                      >
                        <RefreshCwIcon aria-hidden style={{ width: "14px", height: "14px" }} />
                        Retry
                      </button>
                    </div>
                  ) : state.status === "loadingMore" ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "24px 0 8px",
                        gap: "8px",
                        color: "var(--pf-color-foreground, #111)",
                      }}
                    >
                      <Loader2Icon
                        aria-hidden
                        style={{
                          width: "16px",
                          height: "16px",
                          animation: "spin 1s linear infinite",
                        }}
                      />
                      <span>Loading more...</span>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            </CollectionPopupChrome>
          </DialogPrimitive.Popup>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* Nested lightbox rendered outside the popup dialog but controlled by popup state */}
      {open && lightboxImage && (
        <Lightbox
          image={lightboxImage}
          onClose={() => setLightboxImage(null)}
          closeLabel={L.close}
          fullSizeAlt={L.fullSizeAlt}
        />
      )}
    </>
  );
}
