"use client";

const DOT_STYLES = `
.pf-modal-dot {
  position: relative;
  width: 24px;
  height: 24px;
  /* Negative margin pulls adjacent 24px hit areas together so the visible
   * 8px dots keep the original ~16px centre-to-centre density; the hit
   * areas themselves are free to overlap slightly (harmless for taps). */
  margin: 0 -4px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}
.pf-modal-dot::before {
  content: "";
  position: absolute;
  top: 50%;
  left: 50%;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 1px solid rgba(242,242,242,0.55);
  background: transparent;
  transform: translate(-50%, -50%);
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
}
.pf-modal-dot:hover::before {
  border-color: #f2f2f2;
}
.pf-modal-dot:focus-visible {
  outline: 2px solid var(--pf-color-accent, #f2f2f2);
  outline-offset: 2px;
}
.pf-modal-dot:active::before {
  transform: translate(-50%, -50%) scale(0.85);
}
.pf-modal-dot[aria-current="true"]::before {
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
 *
 * Each button is a 24x24px WCAG 2.5.8 tap target; the visible 8px dot (with
 * its border/fill states) is rendered as a centered `::before` pseudo-element
 * so the enlarged hit area stays invisible.
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
