"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, Loader2Icon, RefreshCwIcon, XIcon } from "lucide-react";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { DotPagination } from "../imageModal/DotPagination";
import type { ImmersiveProps } from "./types";

/**
 * `immersive` — full-viewport, one photograph at a time with a filmstrip
 * rail. Renders INSTEAD of CollectionPopupChrome (CollectionPopup mounts this
 * directly inside the dialog popup, skipping the chrome entirely), and it
 * subsumes the image modal: picking a filmstrip frame changes the viewer in
 * place, it never opens a second dialog.
 *
 * Text sits on a fixed near-black scrim regardless of theme — same rule as
 * the `caption`/`cinema` image-modal renditions (see
 * docs/portfolio/template-ideas.md, "Two contrast rules"): the brand
 * foreground token is near-black on every light theme, so it would be
 * invisible here. This is the one popup surface that deliberately ignores
 * the brand kit.
 */
export function Immersive({ status, images, collectionName, hasMore, onLoadMore, onRetry, onClose, labels }: ImmersiveProps) {
  const [rawIndex, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    rootRef.current?.focus();
  }, []);

  // Derived, not stored: images only ever grows (load-more appends), but
  // clamping on read rather than in an effect avoids a redundant render if a
  // future caller ever hands this a shrinking array.
  const index = Math.min(rawIndex, Math.max(0, images.length - 1));

  const atStart = index <= 0;
  const atEnd = index >= images.length - 1;

  const goPrev = () => {
    if (!atStart) setIndex((i) => i - 1);
  };
  const goNext = () => {
    if (!atEnd) {
      setIndex((i) => i + 1);
    } else if (hasMore) {
      onLoadMore();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goPrev();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goNext();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  const active = images[index];
  const fullSrc = active ? imageDeliveryUrl(active.publicId, { width: 2000, fit: "scale-down" }) : "";

  return (
    <div
      ref={rootRef}
      // No role/aria-label here — this always mounts directly inside
      // CollectionPopup's own dialog (role="dialog", aria-label=collectionName
      // on the DialogPrimitive.Popup), so repeating them would create a
      // duplicate nested dialog landmark with the same accessible name.
      data-popup-immersive=""
      aria-label={collectionName}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "#0a0a0a",
        color: "#f2f2f2",
        display: "flex",
        flexDirection: "column",
        outline: "none",
      }}
    >
      <button
        type="button"
        aria-label={labels.close}
        data-popup-close=""
        onClick={onClose}
        style={{
          position: "absolute",
          top: "10px",
          insetInlineEnd: "10px",
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          border: "1px solid rgba(242,242,242,0.3)",
          background: "rgba(0,0,0,0.5)",
          color: "#f2f2f2",
          cursor: "pointer",
        }}
      >
        <XIcon aria-hidden style={{ width: "16px", height: "16px" }} />
      </button>

      {status === "idle" || status === "loading" ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
          <Loader2Icon aria-hidden style={{ width: "20px", height: "20px", animation: "spin 1s linear infinite" }} />
          <span>{labels.loading}</span>
        </div>
      ) : status === "error" ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
          }}
        >
          <p style={{ margin: 0 }}>{labels.failed}</p>
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              border: "1px solid #f2f2f2",
              borderRadius: "4px",
              background: "transparent",
              color: "#f2f2f2",
              cursor: "pointer",
            }}
          >
            <RefreshCwIcon aria-hidden style={{ width: "14px", height: "14px" }} />
            {labels.retry}
          </button>
        </div>
      ) : status === "empty" ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.66 }}>
          {labels.empty}
        </div>
      ) : (
        <>
          {/* Main viewer */}
          <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
            <button
              type="button"
              aria-label={labels.previousPhoto}
              onClick={goPrev}
              disabled={atStart}
              style={{
                position: "absolute",
                insetInlineStart: "16px",
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "1px solid rgba(242,242,242,0.3)",
                background: "rgba(0,0,0,0.5)",
                color: "#f2f2f2",
                cursor: atStart ? "default" : "pointer",
                opacity: atStart ? 0.35 : 1,
              }}
            >
              <ChevronLeftIcon aria-hidden style={{ width: "20px", height: "20px" }} />
            </button>

            {active && fullSrc ? (
              <img
                src={fullSrc}
                alt={active.alt}
                style={{ maxWidth: "90vw", maxHeight: "calc(100vh - 140px)", objectFit: "contain" }}
              />
            ) : null}

            {active && (active.title || active.caption) ? (
              <div
                style={{
                  position: "absolute",
                  bottom: "16px",
                  insetInlineStart: "16px",
                  maxWidth: "60vw",
                  padding: "8px 12px",
                  background: "rgba(0,0,0,0.55)",
                  borderRadius: "4px",
                }}
              >
                {active.title ? <p style={{ margin: 0, fontWeight: 600 }}>{active.title}</p> : null}
                {active.caption ? (
                  <p style={{ margin: "2px 0 0", fontSize: "0.875rem", opacity: 0.85 }}>{active.caption}</p>
                ) : null}
              </div>
            ) : null}

            <button
              type="button"
              aria-label={labels.nextPhoto}
              onClick={goNext}
              disabled={atEnd && !hasMore}
              style={{
                position: "absolute",
                insetInlineEnd: "16px",
                zIndex: 5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                border: "1px solid rgba(242,242,242,0.3)",
                background: "rgba(0,0,0,0.5)",
                color: "#f2f2f2",
                cursor: atEnd && !hasMore ? "default" : "pointer",
                opacity: atEnd && !hasMore ? 0.35 : 1,
              }}
            >
              {status === "loadingMore" && atEnd ? (
                <Loader2Icon aria-hidden style={{ width: "18px", height: "18px", animation: "spin 1s linear infinite" }} />
              ) : (
                <ChevronRightIcon aria-hidden style={{ width: "20px", height: "20px" }} />
              )}
            </button>
          </div>

          {/* Dot pagination — only when the full set is known (no more pages
              to fetch) and small enough that dots stay legible; otherwise
              this layout has never had a position indicator and none is
              added here (no numeric counter for the hasMore/>8 cases). */}
          {!hasMore && images.length <= 8 ? (
            <div
              data-popup-immersive-dots=""
              style={{ display: "flex", justifyContent: "center", gap: "0", padding: "10px 0 0", flexShrink: 0 }}
            >
              <DotPagination
                total={images.length}
                currentIndex={index}
                dotLabelTemplate={labels.photoOf}
                onSelect={setIndex}
              />
            </div>
          ) : null}

          {/* Filmstrip */}
          <div
            role="listbox"
            aria-label={labels.filmstripLabel}
            style={{
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              padding: "10px 12px",
              background: "#000",
              flexShrink: 0,
            }}
          >
            {images.map((img, i) => {
              const thumbSrc = imageDeliveryUrl(img.publicId, { width: 160, height: 160, fit: "cover" });
              const selected = i === index;
              return (
                <button
                  key={img.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={img.alt || labels.openPhoto}
                  onClick={() => setIndex(i)}
                  style={{
                    flexShrink: 0,
                    width: "56px",
                    height: "56px",
                    padding: 0,
                    border: "none",
                    outline: selected ? "2px solid #fff" : "2px solid transparent",
                    outlineOffset: "-2px",
                    background: "transparent",
                    cursor: "pointer",
                    overflow: "hidden",
                    opacity: selected ? 1 : 0.6,
                  }}
                >
                  {thumbSrc ? (
                    <img
                      src={thumbSrc}
                      alt=""
                      aria-hidden="true"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "100%", background: "#333" }} />
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
