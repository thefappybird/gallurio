---
name: portfolio-testing
description: Playwright recipes and gotchas for driving the Gallurio portfolio editor in a real browser. Use this WHENEVER you need to verify a portfolio-editor change end-to-end — walking the guided tour, changing block controls, asserting the canvas grid, performing a drag-and-drop, or screenshotting at breakpoints. It captures the non-obvious bits (storageState auth, the guide's portal locators, the dnd-kit drag technique, reaching gated tour steps, the canvas iframe, the 3-breakpoint rule) so you don't relearn them the hard way. Prefer the Playwright CLI, not the MCP plugin.
---

# Portfolio editor — Playwright recipes

Use the **Playwright CLI** (`pnpm exec playwright test`), not the MCP plugin (token-heavy).

## Budget first — read before writing a spec

Browser runs are the single most expensive thing in this repo. A session once burned
nearly a full day on them. Rules, not suggestions:

1. **Plan the runs before writing any spec.** For a multi-item task, write down a small
   numbered set of runs (typically 2–3 for a whole wave) and which items each one covers.
   A new run must justify itself against that list or fold into an existing one.
2. **One run covers many items.** Never one spec per item. Before adding a run, ask which
   other pending items it can absorb.
3. **A run must answer a question unit tests cannot.** Provable by a unit test → no browser.
4. **One session, one login, no re-navigation.** Open the editor once and walk every
   assertion in that session. No reload / re-navigate / re-poll between assertions.
5. **Editor-internal surfaces: 1280px only.** The 375/768/1280 × 5 locales × light+dark
   sweep is for **public-facing** surfaces — the public portfolio page, contact form,
   marketing pages. Do not run it against in-app editor chrome.
6. **Subagents never run Playwright.** Only the orchestrating session does, serialized the
   same way builds are. Subagents verify with scoped `pnpm test --run <fragment>` + eslint.
7. **Defer to a final wave.** Land static implementation + unit tests across every item
   first, then do one batched runtime pass.

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
- Find anchored controls (e.g. the Contact Form tab) inside the overlay:
  `page.locator('[aria-label="Portfolio editor guide"] [data-tour-id="contact-tab"]')`.
  There is no `header-tab` anchor any more — Navigation is an in-canvas block, not a panel.

## Reaching a gated step
A Next-only walker gets STUCK at gated steps (Next is hidden until the gate is satisfied):
- `drag-block` (step 2) needs a real drag (below).
- `contact-tab` (step 8) advances when you click Contact Form.
Those two are the only gates; the tour is 19 steps ending on `publish`.
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
Public-facing surfaces (contact form, public portfolio pages) cover all three: mobile 375,
tablet 768, desktop 1280 (`test.use({ viewport })`), and carry the 5-locale × light/dark
sweep. **The editor itself is 1280px only** — it is desktop-only in-app chrome, and
multiplying editor assertions across breakpoints, locales and themes is exactly the waste
the budget section forbids. Verify editor behaviour once, at 1280.

## Hygiene
Delete throwaway diagnostic specs and `test-results/` when done. Don't leave a spec whose
assertions pass even when the behavior is broken (e.g. "dialog still exists") — assert the
actual state transition (gate cleared, grid changed).
