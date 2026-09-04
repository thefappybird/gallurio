"use client";

import { NavArrowButton, modalImageSrc, type ImageModalLeafProps } from "../Lightbox";

/**
 * `caption` — the original single-photo lightbox, finished: still one photo
 * on a dark scrim, now with title/description beneath it, prev/next and a
 * position counter when there's more than one image.
 *
 * Contrast rule: this sits on a fixed dark scrim regardless of theme (see
 * BACKDROP_BY_LAYOUT in ../Lightbox), so its text is a fixed near-white
 * (#f2f2f2, muted ~66% for the secondary line), never `var(--pf-color-fg)` —
 * that token is near-black on four of the six brand-kit themes and would be
 * invisible here.
 */
export function CaptionLayout({
  image,
  hasNav,
  canGoPrev,
  canGoNext,
  isPendingMore,
  onPrev,
  onNext,
  fullSizeAlt,
  prevLabel,
  nextLabel,
  counterText,
}: ImageModalLeafProps) {
  const src = modalImageSrc(image.publicId);
  const hasCaptionText = Boolean(image.title || image.caption);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          position: "relative",
          flex: "1 1 auto",
          width: "100%",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px",
        }}
      >
        {hasNav && (
          <NavArrowButton
            direction="prev"
            variant="scrim"
            onClick={onPrev}
            disabled={!canGoPrev}
            pending={false}
            label={prevLabel}
          />
        )}
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={image.alt}
            style={{ maxWidth: "90vw", maxHeight: "68vh", objectFit: "contain", display: "block" }}
          />
        ) : (
          <div style={{ color: "#f2f2f2", padding: "2rem", textAlign: "center" }}>{image.alt || fullSizeAlt}</div>
        )}
        {hasNav && (
          <NavArrowButton
            direction="next"
            variant="scrim"
            onClick={onNext}
            disabled={!canGoNext}
            pending={isPendingMore}
            label={nextLabel}
          />
        )}
      </div>
      {(hasCaptionText || hasNav) && (
        <div style={{ marginTop: "16px", maxWidth: "640px", textAlign: "center" }}>
          {image.title && (
            <p style={{ margin: 0, color: "#f2f2f2", fontSize: "1rem", fontWeight: 600 }}>{image.title}</p>
          )}
          {image.caption && (
            <p style={{ margin: "4px 0 0", color: "rgba(242,242,242,0.66)", fontSize: "0.875rem" }}>
              {image.caption}
            </p>
          )}
          {hasNav && (
            <p style={{ margin: "8px 0 0", color: "rgba(242,242,242,0.66)", fontSize: "0.75rem" }}>
              {counterText}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
