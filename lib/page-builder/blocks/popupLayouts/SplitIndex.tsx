"use client";

import { useId } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { formatPhotoCount, type PopupLayoutBodyProps } from "./types";

/**
 * `split-index` — a sticky narrative column (name, description, facts) on the
 * inline-start side, with a two-up masonry beside it. Stacks under the text
 * on narrow viewports via a scoped media query (mirrors the FOCUS_VISIBLE_STYLES
 * pattern used elsewhere in this file family — inline styles can't express
 * pseudo-classes/media queries on their own).
 *
 * `flexDirection: "row"` is used (never "row-reverse") so the column order
 * follows the document's writing direction automatically under RTL — no
 * manual left/right flip needed.
 */
export function SplitIndex({
  images,
  collectionName,
  collectionDescription,
  total,
  hasMore,
  isLoadingMore,
  loadMoreError,
  onLoadMore,
  onOpen,
  labels,
}: PopupLayoutBodyProps) {
  const scopeId = useId().replace(/:/g, "");
  const countLabel = formatPhotoCount(total, labels);

  return (
    <div className={`pf-split-index-${scopeId}`} style={{ display: "flex", gap: "24px", alignItems: "flex-start" }}>
      <style>{`
        .pf-split-index-${scopeId} { flex-direction: row; }
        .pf-split-index-${scopeId} > [data-split-index-nav] { position: sticky; top: 0; flex: 0 0 300px; }
        @media (max-width: 640px) {
          .pf-split-index-${scopeId} { flex-direction: column; }
          .pf-split-index-${scopeId} > [data-split-index-nav] { position: static; flex-basis: auto; width: 100%; }
        }
      `}</style>

      <div
        data-split-index-nav=""
        style={{
          backgroundColor: "var(--pf-color-secondary, #f0ede7)",
          padding: "24px",
          color: "var(--pf-color-fg, #111)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 600, fontFamily: "var(--pf-font-heading)" }}>
          {collectionName}
        </h3>
        {collectionDescription ? (
          <p style={{ margin: "12px 0 0", fontSize: "0.9375rem", lineHeight: 1.5 }}>{collectionDescription}</p>
        ) : null}
        {countLabel ? (
          <dl style={{ margin: "16px 0 0", padding: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem" }}>
              <dt style={{ opacity: 0.7 }}>{labels.photo}</dt>
              <dd style={{ margin: 0 }}>{countLabel}</dd>
            </div>
          </dl>
        ) : null}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <ul
          aria-label={collectionName}
          style={{
            columnCount: 2,
            columnGap: "8px",
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          {images.map((img, index) => {
            const thumbSrc = imageDeliveryUrl(img.publicId, { width: 600, fit: "scale-down" });
            const aspect =
              img.width && img.height && img.width > 0 && img.height > 0 ? img.width / img.height : 1;
            return (
              <li key={img.id} style={{ breakInside: "avoid", marginBottom: "8px" }}>
                <button
                  type="button"
                  aria-label={img.alt || labels.openPhoto}
                  data-popup-thumb=""
                  onClick={() => onOpen(index)}
                  style={{
                    display: "block",
                    width: "100%",
                    aspectRatio: `${aspect}`,
                    padding: 0,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt={img.alt}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "var(--pf-color-muted, #f0f0f0)" }} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {hasMore && !loadMoreError && !isLoadingMore ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "24px 0 8px" }}>
            <button
              type="button"
              onClick={onLoadMore}
              style={{
                padding: "8px 24px",
                border: "1px solid var(--pf-color-fg, #111)",
                borderRadius: "4px",
                background: "transparent",
                color: "var(--pf-color-fg, #111)",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              {labels.loadMore}
            </button>
          </div>
        ) : loadMoreError ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              padding: "16px 0 8px",
              textAlign: "center",
              color: "var(--pf-color-fg, #111)",
              fontSize: "0.875rem",
            }}
          >
            <span>{labels.loadMoreFailed}</span>
            <button
              type="button"
              data-testid="load-more-retry"
              onClick={onLoadMore}
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
              {labels.retry}
            </button>
          </div>
        ) : isLoadingMore ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px 0 8px",
              gap: "8px",
              color: "var(--pf-color-fg, #111)",
            }}
          >
            <Loader2Icon aria-hidden style={{ width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
            <span>{labels.loadingMore}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
