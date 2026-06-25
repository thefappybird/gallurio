# Side-panel unification + contact styling fixes — spec

Scope: the three non-Puck-block editor side panels — **Navigation** (`HeaderPanelDialog`),
**Contact** (`ContactPanelDialog`), **Featured Popup** (`CollectionsPopupPanelDialog`) —
plus three concrete contact-form rendering bugs.

## Problems (user-reported)
1. **Contact tab styling missing in canvas.** The active/inactive tab "drawer" styles
   apply on the published page but NOT in the editor canvas preview.
2. **Styles not floated.** Controls in Contact / Navigation / Featured Popup don't show
   their effective theme defaults (the "float-up" effective-default display the Puck blocks
   have). The user wants every overridable control floated.
3. **Error message color.** Should default to Gallurio's general CRM error color (the
   app `--destructive`), shown as a selected swatch — not a portfolio-theme color.
4. **Button-tab swatch wiring.** The "background" color swatch displays a white-ish color
   but, when selected, the button renders black. Happens only in these panels, not in the
   Puck blocks/tabs.
5. **Featured Popup design out of sync.** Its properties panel (POPUP / HEADER STYLES
   accordion) doesn't match the Navigation/Contact panels or the Puck blocks.

## Root causes (verified in source)
- **Local control copies (problems 2, 4, 5).** Each panel carries its OWN `ColorSwatchRow`
  + `resolveSwatchHex(token, brandKit)` (`ContactPanelDialog.tsx:43,56`; same pattern in
  `HeaderPanelDialog`, `CollectionsPopupPanelDialog`) instead of the shared
  `toolbarPrimitives.ColorSwatchRow`, which resolves colors from `useBrandColors()` and
  supports `effectiveValue` floating. The panels ARE inside `BrandColorsContext.Provider`
  (EditorShell.tsx:1386–1569) but don't use it. Token sets are identical
  (`CONTACT_BUTTON_COLORS` == `STYLE_COLOR_TOKENS`: primary/secondary/accent/background/foreground),
  so no token reconciliation is needed.
- **Swatch shows white / applies black (problem 4).** `resolveContactColor`
  (`contactButtonAppearance.ts:21`, duplicated in `ContactFormPreview.tsx:23`) builds
  `var(--pf-color-${token})`. For `background`/`foreground` that yields
  `--pf-color-background` / `--pf-color-foreground`, which **do not exist** — the real vars
  are `--pf-color-bg` / `--pf-color-fg` (`styleToolkit.ts:241-242` `TOKEN_VAR`). So the
  applied color falls back (→ wrong/black) while the swatch shows the correct `brandKit`
  hex. primary/secondary/accent var names match, so only bg/fg break; the Puck blocks use
  `colorTokenToVar` (correct) so they're unaffected. Bug is present on the published page
  too, not just canvas.
- **Contact tab styling missing in canvas (problem 1).** `ContactFormPreview.tsx:84`
  renders `<ContactForm>` WITHOUT the contact config, so `getActiveTabExtraStyle(undefined)`
  (`ContactForm.tsx:343`) returns empty styles. The published layout passes the config.
- **Error color (problem 3).** `resolveSubmitAppearance` errorColor fallback is
  `var(--pf-color-accent)` (`contactButtonAppearance.ts:106`); there is no destructive
  token in the palette. CRM `--destructive` = `oklch(0.577 0.245 27.325)` light /
  `oklch(0.704 0.191 22.216)` dark = **`#e7000b`** / `#ff6467`.
- **Featured Popup structure (problem 5).** `CollectionsPopupPanelDialog` uses a custom
  `DesignDrawer` accordion with `openDrawer`/`openSub` state and no tabs; Navigation/Contact
  use the shared `EditorDrawerSection`/`EditorDrawerGroup` under setup/design tabs.

## Target
- **Unify** the three panels onto the shared `toolbarPrimitives` controls (`ColorSwatchRow`,
  `DimensionInput`, `NumberInputRow`, `IconRow`, radius buttons). Delete the local
  `ColorSwatchRow` + `resolveSwatchHex` copies; rely on the in-scope `BrandColorsContext`.
  Result: swatch DISPLAY == APPLIED color; consistent design.
- **Float** effective defaults on EVERY control in the three panels via `effectiveValue`
  (color tokens → brand effective; radius → brand radius; font size → 16; opacity → 100;
  border width → 0; etc.).
- **Fix `resolveContactColor`** to use `colorTokenToVar` (correct bg/fg mapping); export the
  single helper and drop the `ContactFormPreview` duplicate.
- **Pass the contact config** into `ContactForm` from `ContactFormPreview` so canvas tab
  styling matches published.
- **Error color**: add the CRM destructive color as a fixed swatch (`#e7000b` light /
  `#ff6467` dark, via a `--pf-color-destructive` set on the public/preview wrapper or a fixed
  value) and default the contact error-message color to it.
- **Restructure** `CollectionsPopupPanelDialog` to the tabbed `EditorDrawerSection` layout
  matching Navigation/Contact.

## Files (batched, sequential — single shared worktree)
**Batch A — contact rendering bug fixes (small, high-value):**
- `app/(public)/w/[orgSlug]/_components/contactButtonAppearance.ts`: fix + export
  `resolveContactColor` (use `colorTokenToVar`); error fallback → destructive.
- `app/[locale]/(app)/portfolio/_components/ContactFormPreview.tsx`: import shared
  `resolveContactColor`; pass `contactConfig={contact}` to `ContactForm`.
- `lib/page-builder/types.ts`: error-color default wiring as needed.

**Batch B — unify + float Navigation & Contact:**
- `HeaderPanelDialog.tsx`, `ContactPanelDialog.tsx`: delete local `ColorSwatchRow` +
  `resolveSwatchHex`; use shared `ColorSwatchRow` + `effectiveValue` on all controls.
  Editor color labels become the shared English labels (editor chrome is English-only).

**Batch C — Featured Popup restructure + unify + float:**
- `CollectionsPopupPanelDialog.tsx`: replace the custom `DesignDrawer` accordion with tabs +
  `EditorDrawerSection`/`EditorDrawerGroup`; shared controls + float.

## Decisions (locked with user 2026-06-25)
1. **Error swatch scope** — DECIDED: the CRM destructive color (`#e7000b`) is the default
   + an extra swatch ONLY on the contact error-message color control. Block/button/text
   palettes stay the 5 brand tokens.
2. **Featured Popup** — DECIDED: full restructure to the tabbed `EditorDrawerSection`
   layout matching Navigation/Contact.
3. **English-only swatch labels** — DECIDED: drop the contact panel's localized color
   labels (editor chrome is English-only).

## Acceptance
- Swatch display == applied color for ALL tokens incl. background/foreground, in canvas AND
  published.
- Active/inactive contact tab styling visible in the editor canvas (parity with published).
- Every control in the three panels shows its effective default (floated, display-only).
- Contact error message color defaults to the CRM destructive swatch.
- Featured Popup panel matches the Navigation/Contact structure.
- Tests added; `pnpm typecheck` + `pnpm lint` clean; touched suites green. No locale changes
  for editor chrome (English-only); public copy unchanged.
