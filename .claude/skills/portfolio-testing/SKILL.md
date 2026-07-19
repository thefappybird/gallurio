---
name: portfolio-testing
description: Playwright recipes and gotchas for driving the Gallurio portfolio editor in a real browser. Use this WHENEVER you need to verify a portfolio-editor change end-to-end — walking the guided tour, changing block controls, asserting the canvas grid, performing a drag-and-drop, or screenshotting at breakpoints. It captures the non-obvious bits (storageState auth, the guide's portal locators, the dnd-kit drag technique, reaching gated tour steps, the canvas iframe, the 3-breakpoint rule) so you don't relearn them the hard way. Prefer the Playwright CLI, not the MCP plugin.
---

# Portfolio editor — Playwright recipes

Use the **Playwright CLI** (`pnpm exec playwright test`), not the MCP plugin (token-heavy).

## Setup (already wired)
- `playwright.config.ts` loads `.env.local` via dotenv (seed creds never hit source/logs).
  A worktree needs `.env.local` copied from the canonical `dev` checkout to boot.
- `auth.setup.ts` logs in ONCE and saves `storageState` to `e2e/.auth/owner.json`; the
  `chromium` project depends on `setup`. Seed accounts: `SEED_OWNER_*` (+ STAFF/LEAD) in
  `.env.local`. Turnstile is bypassed in dev.
- `webServer` reuses an already-running `pnpm dev` (`reuseExistingServer: true`) or starts
  one (120s). Cold Turbopack boot is slow — poll `http://localhost:3000` before asserting.
- Specs live in `e2e/`. Editor route: `/portfolio`. First load shows a "where would you like
  to start" entry dialog (choose "Start from scratch") then maybe a template picker (Escape).

## Guide tour: the portal trap
`SpotlightGuide` renders its dim+cutout and tooltip card via `createPortal(…, document.body)`.
They are NOT inside `[aria-label="Portfolio editor guide"]`. So:
- Find Next/Back/Skip on `page.locator('[role="dialog"]')` (document-level), NOT scoped to
  the overlay container.
- Find anchored controls (e.g. the Navigation tab) inside the overlay:
  `page.locator('[aria-label="Portfolio editor guide"] [data-tour-id="header-tab"]')`.

## Reaching a gated step
A Next-only walker gets STUCK at gated steps (Next is hidden until the gate is satisfied):
- `drag-block` (step 2) needs a real drag (below).
- `header-tab` (step 8) advances when you click the Navigation tab (opens header).
- `contact-tab` (step 12) advances when you click Contact Form.
To screenshot/verify a late step you must satisfy each gate, not just click Next.

## dnd-kit drag (validated technique)
Puck uses dnd-kit; Playwright `dragTo` doesn't drive its pointer sensor. Do it manually —
the small initial move passes the activation threshold:
```ts
await page.mouse.move(bx, by);            // center of the blocks-panel item
await page.mouse.down();
await page.mouse.move(bx + 6, by + 6);    // activate
await page.waitForTimeout(60);
await page.mouse.move(cx, cy, { steps: 18 }); // to canvas center
await page.mouse.move(cx, cy + 4, { steps: 4 });
await page.mouse.up();
```
This both adds a block and satisfies the `drag-block` gate (verified: `2 of 19 → 3 of 19`).

## Canvas (iframe) assertions
Puck renders the preview in an iframe → reach it with `page.frameLocator(...)`. To prove a
style took effect, assert computed style, e.g. `getComputedStyle(grid).gridTemplateColumns`
has N tracks for Columns. Avoid asserting from source alone — observe the real DOM.

## Breakpoints
Verify at three: mobile 375, tablet 768, desktop 1280 (`test.use({ viewport })`). The editor
is a desktop-only surface — tablet 768 + desktop 1280 is acceptable there; public-facing
surfaces (contact form, public pages) cover all three.

## Hygiene
Delete throwaway diagnostic specs and `test-results/` when done. Don't leave a spec whose
assertions pass even when the behavior is broken (e.g. "dialog still exists") — assert the
actual state transition (gate cleared, grid changed).
