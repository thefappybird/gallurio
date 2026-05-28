# PR #5 — `feat/page-builder/foundation` Code Review

- **PR:** https://github.com/thefappybird/gallurio/pull/5
- **Branch:** `feat/page-builder/foundation` → `dev`
- **Head SHA:** `6360a3a6a32d89b520397ca68904533f3b304b13`
- **Review date:** 2026-05-28

> ## Resolution status — fix commit `940115a` (2026-05-28)
>
> All blocking findings (≥80) plus the actionable below-threshold items were fixed in commit `940115a`. Gates after fixes: **typecheck pass · lint pass (warnings only) · 917 tests pass · production build pass**.
>
> | # | Finding | Status |
> |---|---|---|
> | 1 | ContactCard contact field never populated | ✅ Fixed — `Workspace.contact` subdoc + `buildRenderWorkspace` wiring + regression tests |
> | 2 | Hardcoded English chrome + cross-locale concat | ✅ Fixed — `getTranslations(localeForCountry)`, `publicPage.chrome` in all 5 locales, ICU `startingFrom` |
> | 3 | `blockShapes.test.ts` mocks Mongoose | ✅ Fixed — Mongoose/GalleryItem mocks removed |
> | 4 | Disallowed `lib/page-builder/index.ts` barrel | ✅ Fixed — barrel deleted, imports switched to specific modules |
> | 5 | Triple `findPublishedWorkspaceBySlug` per load | ✅ Fixed — wrapped in `React.cache` (persistent `cacheTag` deferred to Phase 9 publish action) |
> | 6 | Query returns whole doc, no `.select()` | ✅ Fixed — `.select("slug name country branding publicPage contact")` + leak test |
> | 7 | GalleryGrid swallows `CastError` on bad id | ✅ Fixed — `Types.ObjectId.isValid` guard → empty state |
> | 8 | `resolveBrandKit` in a `"use client"` file | ✅ Fixed — extracted to `lib/page-builder/resolveBrandKit.ts` |
> | 9 | `not-found.tsx` raw hex colors | ✅ Fixed — semantic tokens |
> | 10 | `lastPublishedAt`/`latestVersion` unwritten | ✅ Addressed — concise WHY comment (written by Phase 9 publish action) |
> | 11 | mongoose secondary fast-path leaks to prod | ✅ Fixed — gated on `NODE_ENV === "test"` |
> | 12 | Migration lacks batchSize/cursor safety | ⏸️ Deferred — confidence 42, safe at M0 scale; revisit before user-base growth |
> | 13 | `brandKitSchema`/`puckDataSchema` no `.strict()` | ⏸️ Deferred — confidence 38, enum constraints already cover the failure modes |
> | 14 | Worktree at sibling directory | ✅ Fixed — relocated to `.claude/worktrees/feat+page-builder+foundation/` |
- **Methodology:** Five parallel Sonnet reviewers (CLAUDE.md compliance, shallow bug scan, git history regression, prior PR guidance, in-file comment compliance) followed by per-finding Haiku confidence scoring on a 0–100 scale.

Findings are ordered by confidence score (highest first). Anything ≥80 is posted as a GitHub comment on the PR; lower-scored findings are retained here for future reference and follow-up planning.

---

## Findings posted on the PR (confidence ≥ 80)

### 1. `ContactCardBlock` is silently broken in production — `contact` field never populated (confidence 100)

**Files:**
- `app/(public)/w/[orgSlug]/page.tsx` L66–L81 — `renderWorkspace` object omits `contact`
- `lib/page-builder/serverContext.tsx` L38–L50 — `RenderWorkspace.contact` declared but unreachable
- `lib/page-builder/blocks/ContactCardBlock.tsx` L63 — `const contact = workspace?.contact ?? null`
- `lib/db/models/Workspace.ts` — no `contact` subdocument exists on the schema

**Symptom:** every real workspace renders the ContactCard block with no email, phone, address, or socials, because `page.tsx` never copies a `contact` field into the per-request `RenderWorkspace`, and the Mongoose schema has no `contact` field to copy from in the first place. Tests pass because `runWithRenderWorkspace` in the test files injects a synthetic workspace with `contact` populated.

**CLAUDE.md rule violated:** "Errors fail loudly in development and gracefully in production. **Never swallow an exception** without either handling it meaningfully or rethrowing; a silenced error in a tenant-data path is itself a bug." This is a silent data-starvation bug that the tests can't catch.

**Suggested fix:**
- Add a `contact` subdocument to the `Workspace` Mongoose schema (or fold the missing fields into `branding`).
- Wire `workspace.contact` into `renderWorkspace` in `page.tsx`.
- Add a test that calls the real rendering path (not just `runWithRenderWorkspace`) to assert `ContactCardBlock` renders contact rows when present.

---

### 2. i18n: hardcoded English strings in public chrome + string concatenation across locales (confidence 100)

**Files:**
- `app/(public)/w/[orgSlug]/_components/ComingSoonFallback.tsx` L95–L105 — "Coming soon", "Powered by Gallurio"
- `app/(public)/w/[orgSlug]/not-found.tsx` L17–L19 — "Portfolio not found" and body copy
- `lib/page-builder/blocks/ServicesListBlock.tsx` L189 — `Starting from {item.priceFrom}` (JSX string concatenation)
- `messages/{en,fil,ms,id,th}.json` — **zero changes** in this PR

**CLAUDE.md rules violated:**
- "All five locales (en, fil, ms, id, th) update together. **A feature with English-only strings is unfinished.**"
- "Use ICU MessageFormat for plurals and gender; **never string-concatenate translated fragments.**"
- "Public workspace pages (`/w/[orgSlug]`): the Gallurio chrome (inquiry-form labels, footer) uses the workspace's country to pick the locale" — these chrome strings clearly fall under that rule.

**Suggested fix:** Add keys to all five `messages/*.json` files and route the strings through `getTranslations()` / `useTranslations()`. Re-author "Starting from {price}" as an ICU message so non-English locales can reposition the price token (e.g. `"servicesList.startingFrom": "Starting from {price}"`).

---

### 3. `lib/page-builder/blockShapes.test.ts` mocks Mongoose, violating an explicit CLAUDE.md rule (confidence 85)

**File:** `lib/page-builder/blockShapes.test.ts` L46–L58

```ts
vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/db/models/GalleryItem", () => ({
  GalleryItem: {
    find: vi.fn().mockReturnValue({
      sort: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue([]),
    }),
  },
}));
```

**CLAUDE.md rule violated (Testing section):** "**Never mock Mongoose** — use an in-memory MongoDB (`mongodb-memory-server`) so query semantics stay real. Mocked DB tests have repeatedly missed real bugs across this team's history."

The dedicated `GalleryGridBlock.test.tsx` already uses `mongodb-memory-server` via `startInMemoryMongo()` — `blockShapes.test.ts` should follow the same pattern.

---

### 4. New barrel file `lib/page-builder/index.ts` violates the no-barrels rule (confidence 85)

**File:** `lib/page-builder/index.ts` L1–L40

**CLAUDE.md rule violated (Conventions):** "**No barrel files except for `lib/db/models/index.ts`.** Otherwise import from the specific file."

The file's own header comment claims it is "one of the two allowed barrel files," but CLAUDE.md names only one (`lib/db/models/index.ts`). Either delete the barrel and import each symbol from its specific module, or amend CLAUDE.md to formally grant the exception before merging.

---

## Findings below the 80 threshold (kept for follow-up)

These were flagged by reviewer agents but scored below the auto-post threshold. They're real-or-likely concerns worth resolving, but each has either reduced production impact, mitigating context, or a debatable read of the rules.

### 5. Triple call to `findPublishedWorkspaceBySlug` per public page load (confidence 78)

`findPublishedWorkspaceBySlug` is invoked from three places on every public page request: `generateMetadata`, `layout.tsx`, and the page body. There is no `React.cache()` or `unstable_cache` wrapper, so Next.js does not dedupe these (deduplication only applies to `fetch()`). Three MongoDB Atlas round-trips per page hit.

**Fix:** wrap the function in `React.cache(...)` so the per-render call graph dedupes to one DB hit. Add a `cacheTag` keyed on the slug for publish-time invalidation.

**Files:** `lib/db/queries/publicPage.ts`, `app/(public)/w/[orgSlug]/{layout.tsx,page.tsx}`.

---

### 6. `findPublishedWorkspaceBySlug` returns the entire Workspace doc with no `.select()` (confidence 72)

The lean document includes `hitpayRecurringBillingId`, `hitpayRecurringReference`, `hitpayRecurringStatus`, `hitpayCurrentPeriodEnd`, `clerkOrgId`, `ownerUserId`, `plan`, `currency`, etc. None of these are forwarded to the client today, but they are loaded into server memory on every unauthenticated public page hit and create latent leak risk via any future debug log, error-boundary serialization, or accidental `JSON.stringify(workspace)`.

**CLAUDE.md rule:** "Shape responses to the caller. Use `.select()` or projection to ship only what the UI renders."

**Fix:** add `.select("slug name country branding publicPage")` (or a more granular projection per call site).

---

### 7. `GalleryGridBlock` swallows `CastError` from invalid `collectionId` (confidence 72)

If a workspace owner enters a non-ObjectId string into the editor's "Collection ID" field, the Mongoose query throws a `CastError` that is caught by the block's `catch {}` and rendered as `Gallery temporarily unavailable.` — the DB-offline message — instead of the correct `No collection selected.`

**Fix:** guard with `Types.ObjectId.isValid(collectionId)` before querying and return the empty-state message. Don't lump a configuration error into a "DB outage" UX.

**File:** `lib/page-builder/blocks/GalleryGridBlock.tsx` (around L108–L117).

---

### 8. `resolveBrandKit` lives in a `"use client"` file but is imported by a Server Component (confidence 72)

`lib/page-builder/brandKitContext.tsx` starts with `"use client"` (correct for the `BrandKitProvider` / `useBrandKit` hooks). The same file also exports the pure server-safe `resolveBrandKit`, which the barrel re-exports, and which the async Server Component `app/(public)/w/[orgSlug]/layout.tsx` imports. This drags the client context module into the server graph unnecessarily.

**Fix:** extract `resolveBrandKit` into its own `lib/page-builder/resolveBrandKit.ts` (no directive) and import it directly into the layout.

---

### 9. `not-found.tsx` uses raw hex colors and `bg-white` (confidence 68)

`app/(public)/w/[orgSlug]/not-found.tsx` (L17–L19) uses `bg-white`, `text-[#111111]`, `text-[#6b6b6b]`. The CLAUDE.md design carve-out for `/w/[orgSlug]` applies only "inside the public-page wrapper" via the brand kit; a 404 has no workspace, no brand kit, and no wrapper — it falls under the semantic-token-only app-shell rule.

**Fix:** replace with `bg-background`, `text-foreground`, `text-muted-foreground`.

---

### 10. New `lastPublishedAt` and `latestVersion` Workspace fields are never written (confidence 72)

`lib/db/models/Workspace.ts` adds two new fields, but no code in this PR (or on `dev`) writes them. They're intended for the Phase 9 editor's publish flow. Defensible as foundational scaffolding, but worth either adding inline `// wired up in Phase 9` comments or wiring the fields in the existing publish action so the contract is honored from day one.

---

### 11. `lib/db/mongoose.ts` secondary fast-path leaks test behavior into production (confidence 42)

The new `if (mongoose.connection.readyState === 1) { cached.conn = mongoose as unknown as Mongoose; return cached.conn; }` branch exists to support tests that call `mongoose.connect()` directly. In production it's unreachable today (no other code calls `mongoose.connect()`), but it bypasses `maxPoolSize: 10` / `bufferCommands: false` if a future caller ever does. Low risk today; cleaner to gate on `process.env.NODE_ENV === "test"` or to fix the test helper to call `connectDB()`.

---

### 12. Migration script has no batchSize / cursor safety (confidence 42)

`lib/db/migrations/2026-05-portfolio-page-shape.ts` iterates `col.find({})` with no `batchSize`, no `limit`, no progress reporting. Safe at current MVP scale (M0 free tier), but worth adding `.batchSize(N)` plus per-batch logging before the user base grows.

---

### 13. `brandKitSchema` and `puckDataSchema` lack `.strict()` (confidence 38)

Unknown keys pass validation silently with stripping. CLAUDE.md mandates "validate at the boundary with Zod" but does not explicitly require `.strict()`. Low priority — useful defense-in-depth, but the enum constraints on brand-kit fields already block most of the failure modes that strict mode would catch.

---

### 14. Worktree placed at sibling directory (confidence 0 as PR-content finding, but real workflow violation)

Local `git worktree list` shows `D:/Portfolio/Projects/gallurio-page-builder-foundation` instead of `.claude/worktrees/feat+page-builder+foundation/`. CLAUDE.md calls this a non-negotiable rule. Not a PR-diff issue (so not posted to the PR), but worth relocating before the next branch.

---

## What checked out clean

These were explicitly reviewed and found compliant — keeping them documented so future reviews don't redundantly re-investigate:

- **Multi-tenant safety:** `findPublishedWorkspaceBySlug` derives the workspace from `slug` (server-controlled) and tests `publicPage.test.ts` cover cross-tenant isolation explicitly.
- **`GalleryGridBlock` tenant safety:** `workspaceId` is pulled from `getRenderWorkspace()` server context, never from Puck props.
- **`AsyncLocalStorage` design:** replacing the previous module-level singleton with per-request ALS is correct for concurrent Fluid Compute requests.
- **Next.js 16 awaited params:** both `layout.tsx` and `page.tsx` correctly `await params` per the v16 breaking change.
- **Migration idempotency:** the portfolio-page-shape migration checks the existing shape before writing.
- **`bookingsCount` cleanup:** the duplicate field removal in `lib/db/models/Client.ts` correctly resolves a pre-existing schema declaration that appeared twice on `dev`.
- **Block CSS variables:** all six blocks use `--pf-*` variables exclusively and contain no `rounded-*` classes.
- **Per-block compound indexes:** `GalleryItem`'s `{ workspaceId, collectionId, order }` index correctly backs the only new query that uses it.

---

## Suggested next steps

1. Fix findings #1 and #2 (both confidence 100) — these are blocking for any meaningful production launch of the public portfolio.
2. Fix #3 (Mongoose mocking) and #4 (barrel file) to bring the PR into CLAUDE.md compliance.
3. Decide on the lower-confidence items (#5–#10) — most are small follow-up commits that would tighten the foundation before Phase 3 work lands on top.
4. Relocate the local worktree to `.claude/worktrees/feat+page-builder+foundation/` before starting the next branch.
5. Re-run `pnpm typecheck`, `pnpm lint`, and `pnpm test` after fixes; once green, spin an Opus code-review pass per CLAUDE.md's "before merging to dev" gate.
