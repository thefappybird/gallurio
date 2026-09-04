"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { packRows, DEFAULT_GUTTER, DEFAULT_TARGET_HEIGHT } from "./packRows";
import { formatPhotoCount, type PopupLayoutBodyProps } from "./types";

/**
 * `justified` — rows scaled to a common height so every photograph keeps its
 * own aspect ratio; no crop. Container width is measured with a
 * ResizeObserver (packRows is pure and needs a real px width), and the
 * packed row heights are reserved up front so nothing reflows after paint —
 * width starts `null` and renders a fixed-height skeleton row until the
 * first measurement lands.
 */
export function Justified({
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
  const containerRef = useRef<HTMLUListElement>(null);
  const [width, setWidth] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const indexById = useMemo(() => new Map(images.map((img, i) => [img.id, i])), [images]);
  const rows = useMemo(
    () =>
      width
        ? packRows(images, { containerWidth: width, targetHeight: DEFAULT_TARGET_HEIGHT, gutter: DEFAULT_GUTTER })
        : [],
    [images, width]
  );
  const countLabel = formatPhotoCount(total, labels);

  return (
    <>
      {collectionDescription ? (
        <div style={{ marginBottom: "16px" }}>
          <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.5, color: "var(--pf-color-fg, #111)" }}>
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

      <ul
        ref={containerRef}
        aria-label={collectionName}
        style={{ listStyle: "none", margin: 0, padding: 0 }}
      >
        {width == null ? (
          // Reserves target-height space so the ResizeObserver's first tick
          // doesn't cause a visible height jump.
          <li aria-hidden style={{ height: `${DEFAULT_TARGET_HEIGHT}px` }} />
        ) : (
          rows.map((row, ri) => (
            <li
              key={ri}
              style={{
                display: "flex",
                gap: `${DEFAULT_GUTTER}px`,
                marginBottom: ri < rows.length - 1 ? `${DEFAULT_GUTTER}px` : 0,
              }}
            >
              {row.items.map(({ item, width: itemWidth }) => {
                const index = indexById.get(item.id) ?? 0;
                const thumbSrc = imageDeliveryUrl(item.publicId, {
                  width: Math.round(itemWidth * 2),
                  height: Math.round(row.height * 2),
                  fit: "cover",
                });
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-label={item.alt || labels.openPhoto}
                    data-popup-thumb=""
                    onClick={() => onOpen(index)}
                    style={{
                      width: `${itemWidth}px`,
                      height: `${row.height}px`,
                      padding: 0,
                      border: "none",
                      background: "transparent",
                      cursor: "pointer",
                      overflow: "hidden",
                      display: "block",
                      flexShrink: 0,
                    }}
                  >
                    {thumbSrc ? (
                      <img
                        src={thumbSrc}
                        alt={item.alt}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          background: "var(--pf-color-muted, #f0f0f0)",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </li>
          ))
        )}
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
    </>
  );
}
