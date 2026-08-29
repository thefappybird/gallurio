# Editor reliability batch — 12 items

Work order for the twelve issues raised on `fix-feat/portfolio-maker-reliability-and-new-presets`.
Every decision below was chosen by the user; nothing here is inferred.

## 1. Brand background never renders (root cause found)

**Problem.** Minimal's `#fcfcfb` shows as white in the canvas and black in preview.

**Root cause.** `resolveBrandKit` emits `--pf-color-bg`, but **no wrapper ever paints it**.
Both wrappers set only `color`:

- `app/(public)/w/[orgSlug]/layout.tsx:73` — `{ ...cssVars, color: "var(--pf-color-fg)", fontFamily: ... }`
- `app/[locale]/portfolio-preview/_components/PreviewBrandShell.tsx` — `{ ...cssVars, minHeight, color }`

So the page ground falls through to the app shell's `--background`. Preview lives under
`[locale]` (ThemeProvider), so a user in dark theme sees black. The canvas is white because
Puck hardcodes `background: white` on `_PuckCanvas-root_`.

**Target.** Paint `backgroundColor: var(--pf-color-bg)` on both wrappers.

**Also (user chose "fix + full parity test gate").** Sweep every block control that displays an
effective/floated default and assert control value == rendered value, landing it as a permanent
test in the shape of `presetContrast.test.ts`.

## 2. CTA "Image invitation" gets an image card

Currently a full-bleed background image + 62% scrim. **Decision: drop the background image
and scrim**; make it a two-column section — copy + CTA left, `Image` block right, mirroring
Services "Featured service". `backgroundImages` stays `[]`.

## 3. ContactDetails icon alignment

`ContactDetailsBlock.tsx:206` already documents "Controls flex justify-content of the icons row.
Unset -> center (default)" but the Design tab exposes no control. Add left / center / right to
the icons dropdown in `StyleToolkitField`.

## 4. Compact contact bar — vertically center the CTA

`CONTACT_BAR_PRESET` already sets `_style: { cellVerticalAlign: "center" }` on its Button, yet
the button renders top-aligned. Verify whether `cellVerticalAlign` reaches the grid cell; fix the
control or the preset accordingly.

## 5. Missing empty/loading states

The "Choose photos" dialog collapses to just header + footer after creating a collection.
Add real skeletons + empty states to the Photos and Collections tabs in `MediaPicker.tsx`.
**Also audit `CollectionsManagerDialog.tsx`** for the same gap.

## 6. Upload error handling (dedicated agent)

Uploads fail with a generic "Couldn't add photo. Please try again." Replace with the actual
reason — unsupported type, too large, bad dimensions, quota, network. **Audit every upload
field in Gallurio**, not just the portfolio picker, and unify behind one shared error mapper.

## 7. Thumbnails and stale collection lists

- Photos in Content > Photos render no thumbnail.
- "Choose photos" does not see collections created moments earlier without a page reload.

`usePickerData.ts` holds a module-level `pickerDataCache`; `retry()` busts it, but collection
creates outside the picker never call it. Introduce one invalidation path every create/upload
site calls. **Audit every block with a Choose-photos control on its Content tab** (GalleryGrid,
GalleryMasonry, FeaturedWork, CollectionCard, and every Container background uploader).

## 8. Select-photos modal

- Add a checkmark affordance to the collection selector in **photo** mode so a user can take a
  whole collection's contents in one click. (`CollectionSelectGrid` already has one, but only in
  `mode="collections"`.)
- `MediaPicker.tsx:316` `selectAllInCollection()` currently **replaces** the selection
  (`onChange(data.items.slice(0, cap)...)`). It must **append**, de-duplicated, respecting `max`.

## 9. Masonry variants read as grids

`GalleryMasonryBlock` genuinely uses CSS `column-count` with aspect-preserving thumbnails, so
uniform-aspect source photos produce even rows. **Decision: stagger the columns** — give each
column a different vertical offset so the layout reads as masonry regardless of source aspect.
New `_style.galleryStagger`, default off (saved pages unchanged), on for the masonry presets.

## 10. Footer presets must match the mockups

Mockups: `<scratchpad>/presets/footer-{a-signature,b-directory,c-closing-statement}.html`.

- **10.** Directory footer — buttons use a **bottom border only**, no full frame, square corners.
- **10.1.** Closing statement — Home and Gallery on **one row**, not two; same button treatment;
  borders are visibly thicker than the mockup.
- **10.2.** Signature footer — same border treatment; buttons are spread apart instead of
  **bundled together and centered**.

## 11. Custom scrollbars

Compact, theme-aware scrollbars. **Scope: app shell + Puck editor panels** (Puck's CSS-module
scroll containers do not inherit our globals). Public portfolios keep native scrollbars so they
follow the owner's brand.

## 12. Drawer preview modal replaces the verbose rows

- Drawer rows become **name-only**; the one-line description moves into the modal.
- Trigger: **hover on the row, plus a focusable icon** beside the drag handle for keyboard/touch.
- Modal contents: a **live mini-render of the preset** in a small 16:10 frame (real `--pf-*`
  tokens, scaled down), the description, then "Drag this block to add it to your page."

## Done criteria

Per CLAUDE.md: tests, lint, typecheck, all 5 locales, 3 breakpoints x 5 locales x light+dark
browser verification, errors surfaced.
