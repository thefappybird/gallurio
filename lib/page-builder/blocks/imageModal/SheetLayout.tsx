"use client";

import { ModalImage, NavArrowButton, modalImageSrc, type ImageModalLeafProps } from "../Lightbox";

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
    grid-template-columns: repeat(2, minmax(0, 1fr));
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
  additionalInformationLabel,
  dir,
}: ImageModalLeafProps) {
  const src = modalImageSrc(image.publicId);
  const facts: { label: string; value: string }[] = [];
  if (image.date) facts.push({ label: "Date", value: image.date });
  if (image.location) facts.push({ label: "Location", value: image.location });
  if (image.client) facts.push({ label: "Client", value: image.client });
  const meta: { label: string; value: string }[] = [];
  for (const row of image.meta ?? []) {
    if (row.label && row.value) meta.push(row);
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--pf-color-fg, #111) 4%, transparent)",
          }}
        >
          {src ? (
            <ModalImage src={src} alt={image.alt} style={{ width: "100%", height: "min(60vh, 720px)", color: "var(--pf-color-fg, #111)" }} />
          ) : (
            <div style={{ padding: "2rem", textAlign: "center" }}>{image.alt || fullSizeAlt}</div>
          )}
        </div>
        {(image.title || image.caption || tags.length > 0 || facts.length > 0 || meta.length > 0) && (
          <div className="pf-modal-sheet-meta" style={{ display: "grid", gap: "24px" }}>
            <section style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
              {image.title && (
                <h2 style={{ margin: 0, fontFamily: "var(--pf-font-heading)", fontSize: "1.5rem", fontWeight: 600 }}>
                  {image.title}
                </h2>
              )}
              {image.caption && <p style={{ margin: 0, fontSize: "0.9375rem", lineHeight: 1.5 }}>{image.caption}</p>}
              {tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {tags.map((tag) => (
                    <span key={tag} style={{ fontSize: "0.75rem", padding: "2px 8px", borderRadius: "var(--pf-radius, 4px)", border: "1px solid color-mix(in srgb, var(--pf-color-fg, #111) 20%, transparent)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>
            {(facts.length > 0 || meta.length > 0) && (
              <section style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <h3 style={{ margin: 0, fontFamily: "var(--pf-font-heading)", fontSize: "0.8125rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  {additionalInformationLabel}
                </h3>
                <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(5rem, auto) 1fr", columnGap: "12px", rowGap: "8px", fontSize: "0.875rem" }}>
                  {[...facts, ...meta].map((row, i) => (
                    <SheetFactRow key={`${row.label}-${i}`} label={row.label} value={row.value} />
                  ))}
                </dl>
              </section>
            )}
          </div>
        )}
        {hasNav && (
          <div
            style={{
              position: "sticky",
              bottom: 0,
              zIndex: 2,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "16px",
              padding: "12px 0 0",
              borderTop: "1px solid color-mix(in srgb, var(--pf-color-fg, #111) 12%, transparent)",
              background: "color-mix(in srgb, var(--pf-color-bg, #fff) 88%, transparent)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
            }}
          >
            <NavArrowButton direction="prev" variant="brand" onClick={onPrev} disabled={!canGoPrev} pending={false} label={prevLabel} dir={dir} />
            <span style={{ fontSize: "0.8125rem", opacity: 0.65 }}>
              {counterText}
            </span>
            <NavArrowButton direction="next" variant="brand" onClick={onNext} disabled={!canGoNext} pending={isPendingMore} label={nextLabel} dir={dir} />
          </div>
        )}
      </div>
    </div>
  );
}

function SheetFactRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ margin: 0, opacity: 0.6, fontWeight: 500 }}>{label}</dt>
      <dd style={{ margin: 0, overflowWrap: "anywhere" }}>{value}</dd>
    </>
  );
}
