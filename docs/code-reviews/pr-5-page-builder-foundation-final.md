# Final Code Review — `feat/page-builder/foundation`

- **Branch:** `feat/page-builder/foundation` → `dev`
- **Reviewed at:** 940115a (the prior review's fix commit)
- **Date:** 2026-05-28
- **Scope:** Full branch diff `dev...HEAD` — portfolio-maker foundation, Phases 1–3 (Puck config + brand kit + validators; public renderer + schema migration + brand-kit wrapper; six core blocks + per-request tenant context).
- **Method:** Single strict Opus pass over all 40 changed files, every finding verified against `dev` and the codebase before acting.

This is the second review. The first (`pr-5-page-builder-foundation.md`) was already remediated in 940115a; this pass catches anything that review missed or the fix commit introduced.

## Verdict

Branch is sound. No critical or genuinely-blocking issues. Five actionable findings fixed; two flagged items dismissed after verification (one a false positive, one confirmed-intentional scaffolding).

## Findings & resolutions

### Dismissed after verification

- **H1 (claimed) — `Client.bookingsCount` deleted with a false justification.** *False positive.* `git show dev:lib/db/models/Client.ts` and `HEAD:lib/db/models/Client.ts` both contain exactly one `bookingsCount` at line 39. The branch's 1-line deletion removed a genuine **duplicate** declaration; the field remains intact and is still written by `lib/db/clientTransactions.ts` and read by the clients table. No action.
- **M3 — `brandKitContext.tsx` is dead code.** *Dismissed.* It is unused by application code today, but the portfolio-maker plan docs (`phases/phase-1-puck-config.md`, `phases/phase-3-first-six-blocks.md`) explicitly call for `BrandKitProvider`/`useBrandKit` as Phase 3+/editor scaffolding. Deleting it would force a re-add. Retained intentionally.
- **L3 — `inquiryRecipientEmail` carried into the public render context.** *Deferred (confidence 45, defensible).* It stays server-side, is never rendered (proven by `publicPage.test.ts` leak assertions), and is planned Phase-5 contact-form scaffolding. Left as-is.
- **N1 — hardcoded `#ffffff` button text in CTA blocks.** Deferred to a future phase; needs a brand-kit `accent-foreground` token, out of scope here.

### Fixed in this review

- **M1 — `serverContext.tsx` (tenant-isolation linchpin) had no test.** Added `lib/page-builder/serverContext.test.ts` (18 tests): throw-outside-context, `getRenderWorkspace` null path, string + ObjectId `_id` coercion, full `buildRenderWorkspace` mapping incl. null-coalescing of every nested field, and — critically — a **concurrent AsyncLocalStorage isolation test** that interleaves two/three contexts with asymmetric awaits so a module-singleton implementation would fail. Proves the cross-tenant leak cannot happen.
- **M2 — localized `startingFrom` path in `ServicesListBlock` was untested.** Added 3 tests rendering inside `runWithRenderWorkspace` with non-English `chrome.startingFrom` templates (Filipino, Thai), asserting `{price}` substitution and the English fallback. (Render must run *inside* the ALS callback for propagation.)
- **M4 — `GalleryGridBlock` catch block swallowed errors silently.** `catch {` → `catch (err)` with `console.error("GalleryGridBlock query failed", err)` before the graceful-degradation return. Genuine DB faults are now observable in Fluid Compute logs (CLAUDE.md: never silently swallow exceptions in tenant-data paths).
- **L1 — stale comment in `ContactCardBlock.tsx`** claimed request scoping via "React's cache()"; the mechanism is AsyncLocalStorage. Corrected.
- **L2 — false comment in `__fixtures__/homeData.ts`** claimed the seed script consumes the fixture; only tests do. Claim removed.

## Verified clean

- **Tenant isolation:** GalleryGrid always queries `{ workspaceId, collectionId }` from server context, never Puck props; cross-workspace `collectionId` returns empty state (dedicated multi-workspace test).
- **Sensitive-field projection:** public lean doc strips `hitpay*`, `clerkOrgId`, `ownerUserId`, `plan` (asserted in `publicPage.test.ts`); nothing sensitive reaches rendered HTML.
- **`contact` subdoc wiring** (prior fix #1) is correct end-to-end through `ContactCardBlock`.
- **i18n:** all five catalogs (`en/fil/ms/id/th`) carry `publicPage.chrome` incl. `startingFrom` with the `{price}` token preserved; public chrome derives locale from workspace country, not Accept-Language; no fragment concatenation.
- **Next.js 16:** `params` awaited in page/layout/`generateMetadata`; `Render` from `@measured/puck/rsc`; clean server/client boundary (the 940115a `resolveBrandKit` extraction holds — `brandKitContext.tsx` has zero non-test importers in the server graph).
- **Migration** idempotent (`hasNewShape`/`hasBrandKit` guards, `--dry-run`, legacy cleanup).
- **Design rules:** no `rounded-*`; app-shell `not-found.tsx` on semantic tokens; public blocks on `--pf-*` vars under the brand-kit carve-out.
- **No new barrel files; `@/*` imports; HMR-safe model pattern; `mongoose.ts` test-only fast-path gated on `NODE_ENV === "test"`; `{ workspaceId, collectionId, order }` index present.**

## Gates

- `pnpm typecheck` — pass
- `pnpm test --run` (page-builder + public + queries + validators surface) — **281 passed / 14 files**
- `pnpm build` — pass (all 5 locales prerendered)
