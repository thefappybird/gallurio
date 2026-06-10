# Portfolio Builder Control Improvements — Design

Date: 2026-06-10
Branch: `feat/portfolio-enhancements`

Five independent improvements to the Puck-based portfolio builder editor controls. All are editor/renderer changes; none alter the public data contract beyond additive, backward-compatible fields.

## Context (current state)

- Block editor controls live in a custom Puck field, `StyleToolkitField.tsx`, which renders three tabs — **Content / Design / Layout** — driven by `usePuck()` `selectedItem`.
- The carousel heading↔description gap is hardcoded `margin: "0.5rem auto 0"` in `GalleryHeader` (`blocks/GalleryText.tsx`), shared by Carousel, Gallery Grid, Gallery Masonry.
- The "Masonry" section preset label is a hardcoded TS string in `blocks/sectionPresets.ts`; editor chrome is English-only (not localized).
- Padding controls (X/Y + Advanced four-side) currently render in the **Design** tab; margins/gap render in **Layout**.
- The editor Puck config has `root: { fields: {} }` and intentionally **no** `root.render` — a comment at `editorConfig.tsx:815` documents that adding `root.render` breaks Puck drag-and-drop position tracking. Production (`config.ts`) does have a flex-col root render.
- Gallery section presets (`GalleryGridPreset`, `GalleryMasonryPreset`, `FeaturedWorkPreset`) are Container instances with prefilled content slots, registered as distinct Puck component types. They are missing from `CONTAINER_TYPES` and `FLEX_CONTAINER_BLOCKS`, so the panel never shows banner (bg color) or padding controls for them. The carousel is a standalone leaf `<section>`, not a container.

## Scope

### 1. Carousel heading↔description gap control

- Add `headingGap?: number` (px) to `GalleryCarouselProps` in both `blocks/GalleryCarouselBlock.tsx` (production) and `editorConfig.tsx` (editor). Default `8` (= current `0.5rem`).
- `GalleryHeader` gains an optional `gap?: number` prop; the hardcoded `margin: "0.5rem auto 0"` is driven by it (falls back to `8`px when unset). Only the carousel passes `gap`; Grid/Masonry keep the default — no visual change for them.
- Surface the control in the **carousel's Layout tab**. `GalleryLayoutControls` (in `LayoutTabBody`) already edits non-`_style` gallery props (columns/gap/maxItems) via `usePuck` dispatch; add a "Heading–description gap" numeric input there, rendered only when the selected block type is `GalleryCarousel`.

### 2. Rename "Masonry" preset → "Gallery Masonry"

- `blocks/sectionPresets.ts`: `GalleryMasonryPreset.label = "Gallery Masonry"` (title case, matches "Gallery Grid" / "Gallery Carousel").
- The editor preset config reads `SECTION_PRESETS.GalleryMasonryPreset.label`, so the change propagates automatically. No other hardcoded "Masonry" preset string.
- The standalone `GalleryMasonry` block label stays `"Masonry"` (scope: preset label only).
- Not localized → pure TS string change.

### 3. Root page styling (Design + Layout tabs)

Root-level styling editable when no section is selected.

- New `rootStyleField` bound to Puck `root.fields._rootStyle`, reusing the existing `DesignTab` / `LayoutTabBody` tab components, trimmed to **two tabs only** (Design, Layout — no Content tab).
  - **Design:** background color token + background-color opacity. (No background image — explicitly out of scope.)
  - **Layout:** Padding X/Y + Margin X/Y.
- **Production** (`config.ts` root render, which already exists): apply background color (with opacity), padding, and margin to the outer page wrapper.
- **Editor live preview without `root.render`:** an editor-only effect reads `root.props._rootStyle` via `usePuck` and applies bg color / padding / margin as inline styles (or CSS vars) onto the **existing** Puck canvas container element. No DOM re-parenting, no wrapper, no `root.render` — this is what avoids the previously-observed DnD breakage. We only style the element Puck already renders.

### 4. Move padding controls from Design → Layout

- Relocate the Padding control block (X/Y + Advanced four-side) out of `DesignTab` and into `LayoutTabBody`, **above** the existing Gap/Spacing controls, for every block currently showing it (`FLEX_CONTAINER_BLOCKS`).
- Same underlying `_style` fields (`paddingTop/Right/Bottom/Left`) → zero data migration; purely a relocation of where the control renders.

### 5. Gallery section presets — full Container parity

- Add `GalleryGridPreset`, `GalleryMasonryPreset`, `FeaturedWorkPreset` to:
  - `CONTAINER_TYPES` — unlocks the banner background-color (and the rest of the Content-tab container treatment).
  - `FLEX_CONTAINER_BLOCKS` — unlocks padding (now in the Layout tab per #4).
- They are already Container-based with editable content slots; they were simply absent from these type sets. The carousel stays excluded (leaf `<section>`).

### 6. Collections Popup tab — live preview + header/button styling

Bring the Collections Popup editor tab in line with the Header/Contact tabs (live preview pane + right control sidebar), and add title/close-button styling.

- **Layout parity:** Replace the empty left placeholder (`EditorShell.tsx`, the `<div className="flex-1 ... bg-muted/40" />` rendered when `collectionsPopupOpen`) with a real `CollectionsPopupPreview` component, mirroring the `HeaderFormPreview` / `ContactFormPreview` pattern: preview left, `CollectionsPopupPanelDialog` right, updating in realtime via `onChange` → parent `collectionsPopup` state → preview re-render.
- **Preview content:** The preview renders the published popup chrome — the sticky title header (`<h2>`) + the floating circular close button — matching `lib/page-builder/blocks/CollectionPopup.tsx`. Extract the popup chrome (shell + title header + close button) into a shared presentational component so the editor preview and the public render stay in sync (single source of truth). Preview uses a placeholder collection name (e.g. the first/sample collection) so the title is visible.
- **New controls — a collapsible "Header styles" accordion section** in `CollectionsPopupPanelDialog`, with two nested collapsible sub-sections:
  - **Title styles:**
    - **Header text** — text input. Empty/reset → the title defaults to the live collection name. Non-empty → a **global** static override applied to every collection popup.
    - **Text options** — typography kit reused from the Heading block: font family, font size, text color token, bold / italic / underline, and **alignment**. Alignment must position the `<h2>` across the **full width** of the popup header (left / center / right), so the sticky-header layout must let the title justify across the full header width (the asymmetric right padding that clears the close button still applies). **No** highlight controls.
  - **Button styles** (the close button): button size, corner radius, border (width + color), opacity, background color.
- **Config:** Extend the global `collectionsPopup` config object with the additive title fields (`titleText?`, `titleFontFamily?`, `titleFontSize?`, `titleColorToken?`, `titleBold?`, `titleItalic?`, `titleUnderline?`, `titleAlign?`) and close-button fields (`closeButtonSize?`, `closeButtonRadius?`, `closeButtonBorderWidth?`, `closeButtonBorderColorToken?`, `closeButtonOpacity?`, `closeButtonBgColorToken?`). The existing popup shell styling (bg / border / corners) is unchanged.
- **Public render:** `CollectionPopup.tsx` (via the shared chrome component) applies the title override + title typography (with full-width align) and the close-button style fields. When `titleText` is empty it renders the collection name as today.

### 7. Fix preview HTTP 431 (Request Header Fields Too Large)

- **Root cause:** `togglePreview` (`EditorShell.tsx` ~line 559) JSON-stringifies the **entire** draft (`renderDraftData` for all zones + `brandKit` + `contact` + `formLocale` + `headerConfig` + `collectionsPopup`) and `encodeURIComponent`s it into the iframe URL as `?draft=...`. The oversized URL rides in the request headers (alongside Clerk cookies) and trips the server's header-size limit → 431.
- **Fix (client storage):** Stop passing the draft in the URL. Write the draft object to `localStorage` under a stable key (versioned via the existing `LOCAL_DRAFT_VERSION` / `PortfolioBrowserDraft` infra), and pass only a tiny URL: `?zone=...&v=<nonce>` (no `draft` param). The same-origin preview iframe reads the draft from `localStorage` by key.
- **Consequence:** The preview page (`app/[locale]/portfolio-preview/page.tsx`) converts from server-rendered (reading `searchParams.draft`) to **client-rendered** — a client component that reads the draft from `localStorage` and renders via the production Puck `<Render>`/config. The `v` nonce forces a fresh read on each preview. Any data the popup/render needs that isn't already in the draft (e.g. collection images) must be available to the client render — confirm the draft carries everything the preview needs, or fetch the remainder client-side from the existing public endpoint.

## Data model / compatibility

- `headingGap` (carousel), `_rootStyle` (root), and the new `collectionsPopup` title/close-button fields are additive and optional; existing saved data renders unchanged via defaults.
- No migration. No change to `Workspace.publicPage` shape beyond additive Puck props.
- #7 changes only the preview transport (URL param → localStorage); no persisted-data shape change.

## Testing

- Carousel: `headingGap` default + applied gap; `GalleryHeader` honors `gap` prop and defaults when unset.
- Preset label resolves to "Gallery Masonry".
- Root: `_rootStyle` serializes; production wrapper renders bg color (with opacity) + padding + margin.
- Padding control renders under **Layout**, not Design, for container/preset blocks.
- Gallery presets (`GalleryGridPreset`, `GalleryMasonryPreset`, `FeaturedWorkPreset`) now expose banner + padding controls.
- Collections Popup: title text override (default → collection name; non-empty → global override), title typography incl. full-width align, and close-button style fields apply in both the editor preview and the public `CollectionPopup` render; shared chrome component keeps them in sync.
- Preview: building the preview URL no longer includes the draft payload; the draft round-trips through `localStorage`; preview renders correctly with no 431.
- `pnpm typecheck` and `pnpm lint` pass.

## Non-goals

- Root background image / animation (explicitly removed from scope).
- Localizing editor chrome (remains English-only).
- Any change to standalone gallery block (`GalleryGrid` / `GalleryMasonry` / `GalleryCarousel`) labels or to carousel container-ness.
- Horizontal/section-gap semantics for root spacing — root spacing is plain Margin X/Y.
- Per-collection popup title overrides (title override is global) and highlight controls on the popup title.
- Server-side/ephemeral preview draft store (preview transport is client-side localStorage).

## Locales

No new translatable strings (editor chrome is English-only; root styling is structural). No changes across en/fil/ms/id/th.

## Mobile (375px)

Verify root padding/margin and carousel heading gap behave at small width. Verify the Collections Popup live preview (title header + close button) and its controls are usable at 375px, matching the Header/Contact tabs.
