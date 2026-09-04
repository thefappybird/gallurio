"use client";

import { NavArrowButton, modalImageSrc, type ImageModalLeafProps } from "../Lightbox";

const SHEET_STYLES = `
.pf-modal-sheet {
  width: 94vw;
  max-width: 1100px;
}
@media (min-width: 768px) {
  .pf-modal-sheet {
    width: 88vw;
  }
}
.pf-modal-sheet-meta {
  grid-template-columns: 1fr;
}
@media (min-width: 768px) {
  .pf-modal-sheet-meta {
    grid-template-columns: repeat(3, 1fr);
  }
}
`;

/**
 * `sheet` — the photograph inside a page in the site's own colours, floating
 * on a flat scrim rather than a themed one (see ../Lightbox's
 * BACKDROP_BY_LAYOUT comment for why the scrim itself must never derive from
 * a token). The sheet surface paints on brand tokens and inherits the
 * existing 4.5:1 foreground guarantee.
 */
export function SheetLayout({
  image,
  index,
  total,
  hasNav,
  canGoPrev,
  canGoNext,
  isPendingMore,
  onPrev,
  onNext,
  fullSizeAlt,
}: ImageModalLeafProps) {
  const src = modalImageSrc(image.publicId);
  const rows: { label: string; value: string }[] = [];
  if (image.date) rows.push({ label: "Date", value: image.date });
  if (image.location) rows.push({ label: "Location", value: image.location });
  if (image.client) rows.push({ label: "Client", value: image.client });
  for (const row of image.meta ?? []) {
    if (row.label && row.value) rows.push(row);
  }
  const tags = image.tags?.filter(Boolean) ?? [];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <style>{SHEET_STYLES}</style>
      <div
        className="pf-modal-sheet"
        style={{
          background: "var(--pf-color-bg, #fff)",
          color: "var(--pf-color-fg, #111)",
          fontFamily: "var(--pf-font-body)",
          borderRadius: "var(--pf-radius, 4px)",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "24px",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {image.title && (
          <h2 style={{ margin: 0, fontFamily: "var(--pf-font-heading)", fontSize: "1.5rem", fontWeight: 600 }}>
            {image.title}
          </h2>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--pf-color-fg, #111) 4%, transparent)",
          }}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={image.alt} style={{ maxWidth: "100%", maxHeight: "60vh", objectFit: "contain", display: "block" }} />
          ) : (
            <div style={{ padding: "2rem", textAlign: "center" }}>{image.alt || fullSizeAlt}</div>
          )}
        </div>
        {image.caption && <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.5 }}>{image.caption}</p>}
        {rows.length > 0 && (
          <dl className="pf-modal-sheet-meta" style={{ margin: 0, display: "grid", gap: "12px", fontSize: "0.875rem" }}>
            {rows.map((row, i) => (
              <div key={`${row.label}-${i}`}>
                <dt style={{ margin: 0, opacity: 0.6, fontWeight: 500 }}>{row.label}</dt>
                <dd style={{ margin: 0 }}>{row.value}</dd>
              </div>
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
        {hasNav && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", marginTop: "4px" }}>
            <NavArrowButton direction="prev" variant="brand" onClick={onPrev} disabled={!canGoPrev} pending={false} label="Previous image" />
            <span style={{ fontSize: "0.8125rem", opacity: 0.65 }}>
              {index + 1} / {total}
            </span>
            <NavArrowButton direction="next" variant="brand" onClick={onNext} disabled={!canGoNext} pending={isPendingMore} label="Next image" />
          </div>
        )}
      </div>
    </div>
  );
}
