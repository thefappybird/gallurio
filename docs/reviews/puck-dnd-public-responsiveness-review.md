# Code Review: `enhance/puck-dnd-public-responsiveness`

**Reviewed:** container-query responsiveness for the Puck portfolio builder against merge base `ea389b5`. 30 files, focused on `lib/page-builder/responsive.ts` (new), `config.ts`, `RootCanvasStyle.tsx`, the gallery/featured/video/heading blocks, `ContactForm.tsx`, `PortfolioHeader.tsx`, and the editor mocks.

**Verification run:** affected vitest files pass, `pnpm typecheck` passes, ESLint on touched source files clean (2 pre-existing `no-unused-vars` warnings only).

## Summary of correctness on the focus areas

- **Container-query targeting: correct.** Every `@container pfpage` rule targets `[data-block]`; consuming elements are either the `[data-block]` root (padding) or a descendant (grid/masonry/overlay), so custom props cascade in. `data-block` confirmed present on featured-work, gallery-grid, gallery-masonry, gallery-carousel (both states), video, container. Widest→narrowest order (900→600→400) is right: narrowest matching `max-width` wins; un-redeclared props retain the wider tier. `PortfolioHeader` is a sibling of `{children}`, so root `contain: layout` does not break the fixed header.
- **`container-type` side effects: safe.** Block-internal absolute children (carousel overlay, container scrim) resolve against their own `position: relative` wrappers, not the root. `inline-size` (not `size`) avoids height collapse; a test guards against `size`.
- **FeaturedWork inline-grid fix: correct.** The dead `@media .pf-featured-grid` rule is removed; `gridColsVar()` puts the responsive value inline and `--pf-grid-cols` is reassigned on the `[data-block="featured-work"]` ancestor — genuinely fixes the previously non-functional behavior.
- **ContactForm `!important`: correct and necessary.** The form establishes its own local `container-type: inline-size`; `.pf-cf-times` is a descendant, and `!important` is required to beat the inline `grid-template-columns: 1fr 1fr`.

## Findings

### Medium

**1. Carousel overlay padding: responsive var overrides the user's explicit `textPaddingX/Y`.** `GalleryCarouselBlock.tsx`. `textPaddingX/Y` are not emitted by `resolveBlockStyle` (type-only in `styleToolkit.ts`), consumed solely as the `var()` fallback — so the breakpoint `--pf-overlay-px/py: 1rem` always overrides an explicitly-set user value below 600px, contradicting "explicit values win." Fix: make the user value a literal that wins and let the var govern only the default: `_style?.textPaddingY ?? "var(--pf-overlay-py, 1.5rem)"`.

**2. Editor canvas `container-type` applied to a 3-selector list — risk of nested `pfpage` containers.** `RootCanvasStyle.tsx`. If two selectors match nested elements, the inner one wins `@container`/`cqi` resolution and may not be the clamped viewport-toggle surface. In-browser diagnostic showed exactly ONE match (`_PuckPreview_` div, 428px), so it does not currently misfire, but narrow the selector to the single verified surface and assert count === 1.

### Low / informational

**3.** `rootRule` uses `.Puck-root` while the container rule uses `.Puck-frame` — inconsistent; resolved by narrowing the container selector (finding #2).

**4.** Horizontal padding now responsive even when only `paddingY` was set by the user — per-axis "user value wins" still holds (vertical longhand overrides); matches documented intent. QA note only.

**5.** `masonryColsVar(columns) as unknown as number` is a deliberate cast feeding a `var()` string into a numeric `columnCount` slot; renders valid CSS, typechecks. Acceptable.

## Verdict
No Critical/High blockers. Mechanism, cascade order, FeaturedWork fix, and ContactForm `!important` are correct and tested. Address Medium #1 (overlay precedence) and #2 (narrow the editor selector + tighten the e2e assertion) before merge.

## Resolution
- #1 fixed: overlay padding now uses the user value as the winning literal, var only as default.
- #2/#3 fixed: `CANVAS_SURFACE_SELECTOR` narrowed to the verified `[data-puck-preview]`; e2e asserts exactly one `pfpage` container and that it is width-clamped.
- #4/#5: acknowledged, no change required.
