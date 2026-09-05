"use client";

import { NavArrowButton, modalImageSrc, type ImageModalLeafProps } from "../Lightbox";

const SIDEBAR_STYLES = `
.pf-modal-sidebar {
  flex-direction: column;
}
.pf-modal-sidebar-panel {
  width: 100%;
}
@media (min-width: 768px) {
  .pf-modal-sidebar {
    flex-direction: row;
  }
  .pf-modal-sidebar-image {
    flex: 1 1 auto;
    min-width: 0;
  }
  .pf-modal-sidebar-panel {
    flex: 0 0 340px;
    width: 340px;
    max-height: 100%;
  }
}
`;

/**
 * `sidebar` — the photo start-side, a 340px metadata panel end-side on the
 * brand ground. Every metadata group the image carries, visible at once.
 * Drops the panel below the image on narrow viewports (<768px).
 *
 * Paints on brand tokens (`var(--pf-color-*)`), so it inherits the existing
 * 4.5:1 foreground guarantee and needs no special contrast handling — unlike
 * `caption`/`cinema`, which sit on a fixed dark scrim.
 */
export function SidebarLayout({
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
  const facts: { label: string; value: string }[] = [];
  if (image.date) facts.push({ label: "Date", value: image.date });
  if (image.location) facts.push({ label: "Location", value: image.location });
  if (image.client) facts.push({ label: "Client", value: image.client });
  const meta = image.meta?.filter((row) => row.label && row.value) ?? [];
  const tags = image.tags?.filter(Boolean) ?? [];
  const technical = image.width && image.height ? `${image.width} × ${image.height} px` : null;

  return (
    <div
      className="pf-modal-sidebar"
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        overflow: "hidden",
      }}
    >
      <style>{SIDEBAR_STYLES}</style>
      <div
        className="pf-modal-sidebar-image"
        style={{
          position: "relative",
          flex: "1 1 auto",
          minHeight: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "color-mix(in srgb, var(--pf-color-fg, #111) 4%, transparent)",
          padding: "16px",
          boxSizing: "border-box",
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={image.alt}
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block" }}
          />
        ) : (
          <div style={{ color: "var(--pf-color-fg, #111)", padding: "2rem", textAlign: "center" }}>
            {image.alt || fullSizeAlt}
          </div>
        )}
      </div>
      <div
        className="pf-modal-sidebar-panel"
        style={{
          background: "var(--pf-color-bg, #fff)",
          color: "var(--pf-color-fg, #111)",
          fontFamily: "var(--pf-font-body)",
          borderInlineStart: "1px solid color-mix(in srgb, var(--pf-color-fg, #111) 12%, transparent)",
          padding: "20px",
          boxSizing: "border-box",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {image.title && (
          <h2 style={{ margin: 0, fontFamily: "var(--pf-font-heading)", fontSize: "1.125rem", fontWeight: 600 }}>
            {image.title}
          </h2>
        )}
        {image.caption && (
          <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.5 }}>{image.caption}</p>
        )}
        {facts.length > 0 && (
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "12px", rowGap: "6px", fontSize: "0.875rem" }}>
            {facts.map((fact) => (
              <FactRow key={fact.label} label={fact.label} value={fact.value} />
            ))}
          </dl>
        )}
        {meta.length > 0 && (
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "auto 1fr", columnGap: "12px", rowGap: "6px", fontSize: "0.875rem" }}>
            {meta.map((row, i) => (
              <FactRow key={`${row.label}-${i}`} label={row.label} value={row.value} />
            ))}
          </dl>
        )}
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: "0.75rem",
                  padding: "2px 8px",
                  borderRadius: "var(--pf-radius, 4px)",
                  border: "1px solid color-mix(in srgb, var(--pf-color-fg, #111) 20%, transparent)",
                }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {technical && (
          <p style={{ margin: 0, fontSize: "0.75rem", opacity: 0.6 }}>{technical}</p>
        )}
        {hasNav && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 0 0",
              marginTop: "auto",
              borderTop: "1px solid color-mix(in srgb, var(--pf-color-fg, #111) 12%, transparent)",
              background: "linear-gradient(to top, var(--pf-color-bg, #fff) 60%, transparent)",
              backdropFilter: "blur(6px)",
            }}
          >
            <NavArrowButton
              direction="prev"
              variant="brand"
              onClick={onPrev}
              disabled={!canGoPrev}
              pending={false}
              label={prevLabel}
            />
            <span style={{ fontSize: "0.8125rem", opacity: 0.65 }}>
              {counterText}
            </span>
            <NavArrowButton
              direction="next"
              variant="brand"
              onClick={onNext}
              disabled={!canGoNext}
              pending={isPendingMore}
              label={nextLabel}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ margin: 0, opacity: 0.6, fontWeight: 500 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </>
  );
}
