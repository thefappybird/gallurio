"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { formatPhotoCount, type PopupLayoutBodyProps } from "./types";

/**
 * `contact-sheet` — the original popup body (uniform squares, six per row),
 * extracted verbatim from CollectionPopup.tsx.
 *
 * BACK-COMPAT CONTRACT: when `collectionDescription` is absent (every page
 * saved before this feature), this must render exactly what shipped before —
 * same elements, same styles, same text — so CollectionPopup.test.tsx (which
 * never passes a description) keeps passing unmodified. The only structural
 * change from the original inline JSX is wrapping the grid in a real
 * `<ul>/<li>` list (the a11y non-negotiable) instead of a bare flex `<div>`;
 * every button/img attribute, style and string is untouched, so no existing
 * assertion (which never queries the parent tag) is affected.
 */
export function ContactSheet({
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
  const countLabel = formatPhotoCount(total, labels);

  return (
    <>
      {/* Net-new header — only rendered once a collection has a description,
       *  so pages saved before this feature never see it (back-compat). */}
      {collectionDescription ? (
        <div style={{ marginBottom: "16px" }}>
          <p
            style={{
              margin: 0,
              fontSize: "0.9375rem",
              lineHeight: 1.5,
              color: "var(--pf-color-fg, #111)",
            }}
          >
            {collectionDescription}
          </p>
          {countLabel ? (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: "0.875rem",
                color: "color-mix(in srgb, var(--pf-color-fg, #111) 62%, transparent)",
              }}
            >
              {countLabel}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Image grid, roughly six per row, reflowing on smaller screens */}
      <ul
        aria-label={collectionName}
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px",
          listStyle: "none",
          margin: 0,
          padding: 0,
        }}
      >
        {images.map((img, index) => {
          const thumbSrc = imageDeliveryUrl(img.publicId, {
            width: 400,
            height: 400,
            fit: "cover",
          });
          return (
            <li
              key={img.id}
              style={{
                flex: "0 0 calc(100% / 6 - 7px)",
                minWidth: "120px",
              }}
            >
              <button
                type="button"
                aria-label={img.alt || labels.openPhoto}
                data-popup-thumb=""
                onClick={() => onOpen(index)}
                style={{
                  width: "100%",
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
                    {img.alt || labels.photo}
                  </div>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {/* Load more / loading more / inline load-more error */}
      {hasMore && !loadMoreError && !isLoadingMore ? (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "24px 0 8px",
          }}
        >
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
          <Loader2Icon
            aria-hidden
            style={{
              width: "16px",
              height: "16px",
              animation: "spin 1s linear infinite",
            }}
          />
          <span>{labels.loadingMore}</span>
        </div>
      ) : null}
    </>
  );
}
