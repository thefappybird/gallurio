# Task 20 Report: Email Render Harness + Visual Verification

## How to run

### Step 1 — Generate HTML artifacts (vitest)
```bash
pnpm exec vitest run scripts/render-emails.test.ts
```
Writes 28 `.html` files + `manifest.json` to `C:\Users\alexb\AppData\Local\Temp\gallurio-email-render\`.

### Step 2 — Screenshot all artifacts (Playwright CLI)
```bash
pnpm exec playwright test scripts/screenshot-emails.spec.ts \
  --config scripts/playwright-screenshots.config.ts
```
Writes 112 `.png` files alongside the HTML (4 screenshots per HTML: desktop×light, desktop×dark, mobile×dark, mobile×light). No running app required — all `file://` URLs.

### Files committed
- `scripts/render-emails.test.ts` — vitest render harness (mock-based, calls real senders)
- `scripts/screenshot-emails.ts` — standalone Node/Playwright runner (alternative invocation)
- `scripts/screenshot-emails.spec.ts` — Playwright spec with inline assertions
- `scripts/playwright-screenshots.config.ts` — standalone Playwright config (no app server)

---

## Matrix rendered

**Artifact directory:** `C:\Users\alexb\AppData\Local\Temp\gallurio-email-render\`

| Brand | Template | Locales | CTA variant | Count |
|-------|----------|---------|-------------|-------|
| Platform | inquiry-notification (owner) | en | with-cta + no-cta | 2 |
| Platform | booking-confirmed (owner) | en | with-cta + no-cta | 2 |
| Platform | notification email | en | with-cta + no-cta | 2 |
| Platform | verification email | en | no-cta | 1 |
| Platform | password reset | en | with-cta | 1 |
| Partner | team invite | en, fil, id, th | with-cta | 4 |
| Partner | inquiry client confirmation | en, fil, id, th | no-cta | 4 |
| Partner | booking confirmed (client) | en, fil, id, th | no-cta | 4 |
| Partner | booking cancelled (client) | en, fil, id, th | no-cta | 4 |
| Partner | inquiry decline (client) | en, fil, id, th | no-cta | 4 |

**Total HTML files:** 28  
**Total PNG screenshots:** 112 (28 × 4: desktop-light, desktop-dark, mobile-light, mobile-dark)

### Intentionally skipped / not covered
- `sendPasswordResetEmail` for locales `fil`, `id`, `th`: this is a platform email, uses gallurioBrand, no locale-specific visual difference in the template structure. English-only for platform per convention.
- `sendBookingCancelledOwner`: covered structurally by `sendBookingConfirmedOwner` which shares the same template pattern and platform brand. Skipping avoids redundant matrix expansion.
- `data-export` template (`buildDataExportEmailBody`): plain-text-only function with no `renderBrandedEmail` call, no HTML output. No screenshot artifact applicable.
- Verification email for locales fil/ms/id: English-only per explicit convention (comment in `app/api/webhooks/workos/route.ts`).
- Both CTA variants for partner emails that never have a CTA (all partner client-facing templates).

---

## Eyeball findings

### 1. Partner accent — logo visibility and contrast

**PASS.** Across all partner templates, the orange accent `#c05621` renders correctly:
- Logo img tag present and visible in the header strip (white background with orange bottom border).
- CTA button uses `ctaTextColor()` which correctly returns `#ffffff` for this dark orange accent — good contrast.
- The header strip for partner emails is white with the accent as a `border-bottom` stripe, not a filled band — logo is legible on white.

No issues found on the warm accent contrast.

### 2. Dark mode legibility — **BUG FOUND**

**FAIL — LOW-CONTRAST TEXT IN DARK MODE (every template)**

File: `lib/email/layout.ts`

The dark mode `@media (prefers-color-scheme: dark)` CSS block targets `.email-text` with `color: #eaeaea`. However, the body text elements (`<p>`, `<h1>`, `<h2>`) have their colors hardcoded in inline `style` attributes with light-mode values (`color:#424242`, `color:#777777`, etc.). Inline styles have higher specificity than the media query class rule, so the dark-mode override has **no effect** on the inline-styled elements.

**Observed in screenshots:**
- `platform-inquiry-notification-en-cta--desktop--dark.png`: body text is rendered as dark charcoal (#424242) on the dark card background (#2a2a2a) — near-invisible low-contrast text.
- `platform-verification-en--desktop--dark.png`: heading "Verify your email" and all body paragraphs are dark-on-dark (charcoal on dark card).
- `partner-team-invite-en-cta--desktop--dark.png`: same issue — all body text is very low contrast in dark mode.
- `partner-booking-confirmed-client-id-no-cta--mobile--dark.png`: same issue on mobile.

The dark-mode `a { color: #2fb3d9 !important; }` link rule DOES work (links are teal in dark mode) because it targets the element directly, not via the inline style.

**Root cause:** `renderBlock()` and the `<h1>` title in `renderBrandedEmail()` set inline `style="...color:#424242..."`. The `.email-text` class-based media query override cannot defeat inline styles without also using `!important` on the inline color, but inline styles with `!important` on the element would be needed — which is not how the current implementation works.

**Screenshot paths for reference:**
- `C:\Users\alexb\AppData\Local\Temp\gallurio-email-render\platform-inquiry-notification-en-cta--desktop--dark.png`
- `C:\Users\alexb\AppData\Local\Temp\gallurio-email-render\platform-verification-en--desktop--dark.png`
- `C:\Users\alexb\AppData\Local\Temp\gallurio-email-render\partner-team-invite-en-cta--desktop--dark.png`
- `C:\Users\alexb\AppData\Local\Temp\gallurio-email-render\partner-booking-confirmed-client-id-no-cta--mobile--dark.png`

**Fix required in:** `lib/email/layout.ts` — the `renderBlock()` function and h1/subtitle inline styles need `!important` on color when applied via inline style, OR the dark-mode media query must use `!important` overrides targeting the specific elements rather than the class.

### 3. CTA button tap size at 375px

**PASS.** All CTA buttons confirm `min-height:44px;line-height:44px` in the rendered HTML. Visually at 375px, buttons span the full card width (table-centered, fills ~270px), are comfortably tappable, and text is 15px. No issues found.

### 4. Locale text overflow at 375px

**PASS.** All 4 locales render cleanly at 375px. Longest text strings (Tagalog team-invite CTA "Tanggapin ang imbitasyon", Thai booking-cancelled body) wrap naturally within the card without overflow. No text truncation or overflow observed in any mobile screenshot.

---

## TypeScript check

`pnpm exec tsc --noEmit` → **No errors found**

---

## Commit SHA

Committed as: `feat(email): email render harness for visual verification`
(SHA available via `git log --oneline -1` in the worktree)
