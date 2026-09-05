"use client";

const DOT_STYLES = `
.pf-modal-dot {
  width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 50%;
  border: 1px solid rgba(242,242,242,0.55);
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.pf-modal-dot:hover {
  border-color: #f2f2f2;
}
.pf-modal-dot:focus-visible {
  outline: 2px solid var(--pf-color-accent, #f2f2f2);
  outline-offset: 2px;
}
.pf-modal-dot:active {
  transform: scale(0.85);
}
.pf-modal-dot[aria-current="true"] {
  background: #f2f2f2;
  border-color: #f2f2f2;
}
`;

/**
 * Shared dot-pagination row used by every fixed-dark-scrim photo viewer
 * (image-modal `caption`/`cinema` layouts, popup `immersive` layout). Renders
 * only the `<style>` tag + one `<button>` per photo — callers keep their own
 * wrapping container div, since its layout (gap/justify/padding) differs per
 * call site while the dots themselves are byte-for-byte identical.
 */
export function DotPagination({
  total,
  currentIndex,
  dotLabelTemplate,
  onSelect,
}: {
  total: number;
  currentIndex: number;
  /** Template with literal "{current}"/"{total}" tokens. */
  dotLabelTemplate: string;
  onSelect: (index: number) => void;
}) {
  return (
    <>
      <style>{DOT_STYLES}</style>
      {Array.from({ length: total }, (_, i) => (
        <button
          key={i}
          type="button"
          className="pf-modal-dot"
          aria-current={i === currentIndex ? "true" : undefined}
          aria-label={dotLabelTemplate.replace("{current}", String(i + 1)).replace("{total}", String(total))}
          onClick={() => onSelect(i)}
        />
      ))}
    </>
  );
}
