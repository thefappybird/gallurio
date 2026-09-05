"use client";

import { NavArrowButton, modalImageSrc, type ImageModalLeafProps } from "../Lightbox";
import { SeeMoreMetaPanel } from "./SeeMoreMetaPanel";

const CAPTION_STYLES = `
.pf-modal-caption-dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(242,242,242,0.55);
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.pf-modal-caption-dot:hover {
  border-color: #f2f2f2;
}
.pf-modal-caption-dot:focus-visible {
  outline: 2px solid var(--pf-color-accent, #f2f2f2);
  outline-offset: 2px;
}
.pf-modal-caption-dot:active {
  transform: scale(0.85);
}
.pf-modal-caption-dot[aria-current="true"] {
  background: #f2f2f2;
  border-color: #f2f2f2;
}
`;

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
  onSelect,
  index,
  total,
  fullSizeAlt,
  prevLabel,
  nextLabel,
  counterText,
  seeMoreLabel,
  seeLessLabel,
}: ImageModalLeafProps) {
  const src = modalImageSrc(image.publicId);
  const hasCaptionText = Boolean(image.title || image.caption);
  const facts: { label: string; value: string }[] = [];
  if (image.date) facts.push({ label: "Date", value: image.date });
  if (image.location) facts.push({ label: "Location", value: image.location });
  if (image.client) facts.push({ label: "Client", value: image.client });
  const meta = image.meta?.filter((row) => row.label && row.value) ?? [];
  const tags = image.tags?.filter(Boolean) ?? [];
  const hasMetaExtra = facts.length > 0 || meta.length > 0 || tags.length > 0;

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
      <style>{CAPTION_STYLES}</style>
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
      {(hasCaptionText || hasNav || hasMetaExtra) && (
        <div style={{ position: "relative", marginTop: "16px", maxWidth: "640px", textAlign: "center" }}>
          {image.title && (
            <p style={{ margin: 0, color: "#f2f2f2", fontSize: "1rem", fontWeight: 600 }}>{image.title}</p>
          )}
          {image.caption && (
            <p style={{ margin: "4px 0 0", color: "rgba(242,242,242,0.66)", fontSize: "0.875rem" }}>
              {image.caption}
            </p>
          )}
          {hasNav && (
            total <= 8 ? (
              <div
                className="pf-modal-caption-dots"
                style={{ marginTop: "8px", display: "flex", justifyContent: "center", gap: "8px" }}
              >
                {Array.from({ length: total }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    className="pf-modal-caption-dot"
                    aria-current={i === index ? "true" : undefined}
                    aria-label={`Photo ${i + 1} of ${total}`}
                    onClick={() => onSelect(i)}
                  />
                ))}
              </div>
            ) : (
              <p style={{ margin: "8px 0 0", color: "rgba(242,242,242,0.66)", fontSize: "0.75rem" }}>
                {counterText}
              </p>
            )
          )}
          <SeeMoreMetaPanel
            key={image.id}
            facts={facts}
            meta={meta}
            tags={tags}
            seeMoreLabel={seeMoreLabel}
            seeLessLabel={seeLessLabel}
          />
        </div>
      )}
    </div>
  );
}
