"use client";

import { useId, useState } from "react";

/**
 * `SeeMoreMetaPanel` — collapsed-by-default "See more" disclosure for facts/
 * meta/tags, meant to sit inside `CaptionLayout`/`CinemaLayout` (both fixed
 * dark-scrim layouts, see those files' contrast-rule comments). Fixed
 * near-white-on-dark palette here too (`#f2f2f2` / `rgba(242,242,242,0.66)`),
 * never brand colour tokens — this component only ever renders on that scrim.
 * Typography still follows the site's brand fonts.
 *
 * The disclosure establishes its own positioning context. Its expanded panel
 * is anchored above the trigger, so it grows over (and blurs) the photograph
 * instead of stealing more space below it. Keying this component on `image.id`
 * (or unmounting/
 * remounting per image) is the caller's job for resetting expanded state on
 * image change — no internal effect does that here.
 *
 * Stacking: the expanded panel carries its own scrim background (sized to
 * whatever height its own content actually is, since real metadata can be
 * several times taller than the caller's chrome bar) and sits at z-index 0 —
 * The panel deliberately paints above nearby pagination chrome. Because it is
 * anchored before the cinema filmstrip, it expands into the image rather than
 * down across the thumbnail rail.
 */
export function SeeMoreMetaPanel({
  title,
  description,
  facts,
  meta,
  tags,
  seeMoreLabel,
  seeLessLabel,
  additionalInformationLabel,
}: {
  title?: string;
  description?: string;
  facts: { label: string; value: string }[];
  meta: { label: string; value: string }[];
  tags: string[];
  seeMoreLabel: string;
  seeLessLabel: string;
  additionalInformationLabel?: string;
}): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (facts.length === 0 && meta.length === 0 && tags.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        marginTop: "8px",
        fontFamily: "var(--pf-font-body)",
      }}
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          position: "relative",
          zIndex: 1,
          background: "transparent",
          border: "none",
          padding: 0,
          color: "#f2f2f2",
          fontSize: "0.8125rem",
          fontWeight: 600,
          fontFamily: "inherit",
          cursor: "pointer",
        }}
      >
        {expanded ? seeLessLabel : seeMoreLabel}
      </button>
      {expanded && (
        <div
          id={panelId}
          style={{
            position: "absolute",
            zIndex: 2,
            bottom: "calc(100% + 8px)",
            insetInline: 0,
            maxHeight: "min(320px, 60vh)",
            overflowY: "auto",
            boxSizing: "border-box",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            color: "#f2f2f2",
            fontFamily: "var(--pf-font-body)",
            background: "rgba(0,0,0,0.62)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            transformOrigin: "bottom center",
            animation: "pf-photo-meta-expand 180ms ease-out both",
          }}
        >
          <style>{`
            @keyframes pf-photo-meta-expand { from { opacity: 0; transform: translateY(10px) scaleY(.96); } to { opacity: 1; transform: translateY(0) scaleY(1); } }
            #${panelId} .pf-photo-meta-grid { grid-template-columns: minmax(0, 1fr); }
            @media (min-width: 768px) { #${panelId} .pf-photo-meta-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
            @media (prefers-reduced-motion: reduce) { #${panelId} { animation: none !important; } }
          `}</style>
          <div
            className="pf-photo-meta-grid"
            style={{
              display: "grid",
              width: "100%",
              maxWidth: "700px",
              marginInline: "auto",
              gap: "24px",
              textAlign: "start",
            }}
          >
            <section
              data-meta-column="primary"
              style={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {title && (
                <h2
                  style={{
                    margin: 0,
                    fontFamily: "var(--pf-font-heading)",
                    fontSize: "1rem",
                    fontWeight: 600,
                  }}
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  style={{
                    margin: 0,
                    color: "rgba(242,242,242,0.76)",
                    fontSize: "0.875rem",
                    lineHeight: 1.5,
                  }}
                >
                  {description}
                </p>
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
                        border: "1px solid rgba(242,242,242,0.33)",
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </section>
            {(facts.length > 0 || meta.length > 0) && (
              <section
                data-meta-column="additional"
                style={{
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                {additionalInformationLabel && (
                  <h3
                    style={{
                      margin: 0,
                      fontFamily: "var(--pf-font-heading)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {additionalInformationLabel}
                  </h3>
                )}
                <dl
                  style={{
                    margin: 0,
                    display: "grid",
                    gridTemplateColumns: "auto 1fr",
                    columnGap: "12px",
                    rowGap: "6px",
                    fontSize: "0.875rem",
                  }}
                >
                  {facts.map((fact) => (
                    <FactRow key={fact.label} label={fact.label} value={fact.value} />
                  ))}
                  {meta.map((row, i) => (
                    <FactRow key={`${row.label}-${i}`} label={row.label} value={row.value} />
                  ))}
                </dl>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FactRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ margin: 0, color: "rgba(242,242,242,0.66)", fontWeight: 500 }}>{label}</dt>
      <dd style={{ margin: 0, color: "#f2f2f2" }}>{value}</dd>
    </>
  );
}
