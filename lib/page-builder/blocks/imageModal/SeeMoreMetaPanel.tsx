"use client";

import { useId, useState } from "react";

/**
 * `SeeMoreMetaPanel` — collapsed-by-default "See more" disclosure for facts/
 * meta/tags, meant to sit inside `CaptionLayout`/`CinemaLayout` (both fixed
 * dark-scrim layouts, see those files' contrast-rule comments). Fixed
 * near-white-on-dark palette here too (`#f2f2f2` / `rgba(242,242,242,0.66)`),
 * never brand tokens — this component only ever renders on that scrim.
 *
 * Caller contract: the immediate parent MUST be `position: relative` so this
 * panel's `position: absolute; bottom: 0` anchors correctly and grows
 * upward. Also: keying this component on `image.id` (or unmounting/
 * remounting per image) is the caller's job for resetting expanded state on
 * image change — no internal effect does that here.
 */
export function SeeMoreMetaPanel({
  facts,
  meta,
  tags,
  seeMoreLabel,
  seeLessLabel,
}: {
  facts: { label: string; value: string }[];
  meta: { label: string; value: string }[];
  tags: string[];
  seeMoreLabel: string;
  seeLessLabel: string;
}): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (facts.length === 0 && meta.length === 0 && tags.length === 0) {
    return null;
  }

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((prev) => !prev)}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          color: "#f2f2f2",
          fontSize: "0.8125rem",
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        {expanded ? seeLessLabel : seeMoreLabel}
      </button>
      {expanded && (
        <>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.5)",
              backdropFilter: "blur(6px)",
            }}
          />
          <div
            id={panelId}
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              maxHeight: "min(320px, 60vh)",
              overflowY: "auto",
              boxSizing: "border-box",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              color: "#f2f2f2",
            }}
          >
            {(facts.length > 0 || meta.length > 0) && (
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
          </div>
        </>
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
