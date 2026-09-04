"use client";

import { useEffect, useRef, useState } from "react";
import { imageDeliveryUrl } from "@/lib/storage/imageDelivery.client";
import { NavArrowButton, modalImageSrc, type ImageModalLeafProps } from "../Lightbox";

const CINEMA_STYLES = `
.pf-modal-cinema-chrome {
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.pf-modal-cinema-chrome[data-hidden="true"] {
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
}
.pf-modal-cinema-filmstrip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 8px 12px;
  scrollbar-width: thin;
}
.pf-modal-cinema-frame {
  flex: 0 0 auto;
  width: 56px;
  height: 40px;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  opacity: 0.6;
  background: rgba(255,255,255,0.08);
}
.pf-modal-cinema-frame:hover {
  opacity: 0.85;
}
.pf-modal-cinema-frame:focus-visible {
  outline: 2px solid #f2f2f2;
  outline-offset: 2px;
}
.pf-modal-cinema-frame[aria-selected="true"] {
  opacity: 1;
  border-color: #f2f2f2;
}
.pf-modal-cinema-frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
`;

/**
 * `cinema` — full-bleed photo on a near-black ground, a collapsible metadata
 * bar over a bottom gradient, and a filmstrip rail with the current frame
 * marked. Chrome auto-fades after a pause of no interaction and reappears on
 * pointer/keyboard activity.
 *
 * Contrast rule: fixed near-white text (#f2f2f2 / muted ~66%), same as
 * `caption` — see ../Lightbox's BACKDROP_BY_LAYOUT comment.
 */
export function CinemaLayout({
  image,
  images,
  index,
  hasNav,
  canGoPrev,
  canGoNext,
  isPendingMore,
  onPrev,
  onNext,
  onSelect,
  fullSizeAlt,
  prevLabel,
  nextLabel,
  counterText,
  filmstripLabel,
}: ImageModalLeafProps) {
  const src = modalImageSrc(image.publicId);
  const [chromeVisible, setChromeVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function wake() {
      setChromeVisible(true);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setChromeVisible(false), 3200);
    }
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  const hasMeta = Boolean(image.title || image.caption);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#000",
        overflow: "hidden",
      }}
    >
      <style>{CINEMA_STYLES}</style>
      <div style={{ position: "relative", flex: "1 1 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={image.alt}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <div style={{ color: "#f2f2f2", padding: "2rem", textAlign: "center" }}>{image.alt || fullSizeAlt}</div>
        )}
        {hasNav && (
          <div
            className="pf-modal-cinema-chrome"
            data-hidden={!chromeVisible}
            style={{ position: "absolute", inset: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", pointerEvents: "none" }}
          >
            <span style={{ pointerEvents: "auto" }}>
              <NavArrowButton direction="prev" variant="scrim" onClick={onPrev} disabled={!canGoPrev} pending={false} label={prevLabel} />
            </span>
            <span style={{ pointerEvents: "auto" }}>
              <NavArrowButton direction="next" variant="scrim" onClick={onNext} disabled={!canGoNext} pending={isPendingMore} label={nextLabel} />
            </span>
          </div>
        )}
      </div>

      {(hasMeta || hasNav) && (
        <div
          className="pf-modal-cinema-chrome"
          data-hidden={!chromeVisible}
          style={{
            position: "relative",
            background: "linear-gradient(to top, rgba(0,0,0,0.85), rgba(0,0,0,0))",
            padding: "24px 16px 12px",
            color: "#f2f2f2",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ minWidth: 0 }}>
              {image.title && <p style={{ margin: 0, fontSize: "1rem", fontWeight: 600 }}>{image.title}</p>}
              {image.caption && (
                <p style={{ margin: "2px 0 0", fontSize: "0.8125rem", color: "rgba(242,242,242,0.66)" }}>{image.caption}</p>
              )}
            </div>
            {hasNav && (
              <span style={{ fontSize: "0.75rem", color: "rgba(242,242,242,0.66)", flex: "0 0 auto" }}>
                {counterText}
              </span>
            )}
          </div>
          {hasNav && (
            <div className="pf-modal-cinema-filmstrip" role="listbox" aria-label={filmstripLabel} aria-orientation="horizontal">
              {images.map((frame, i) => {
                const thumbSrc = imageDeliveryUrl(frame.publicId, { width: 160, height: 120, fit: "cover" });
                const selected = i === index;
                return (
                  <button
                    key={frame.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    tabIndex={selected ? 0 : -1}
                    className="pf-modal-cinema-frame"
                    onClick={() => onSelect(i)}
                  >
                    {thumbSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbSrc} alt="" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
