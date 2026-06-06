# Code review — `update/bookings-enhancements`

Reviewer: senior staff engineer (adversarial pass)
Base: `dev` · Head: `update/bookings-enhancements`
Date: 2026-05-28

Verification run during review:
- `pnpm typecheck` — passes.
- `pnpm vitest run` on all changed/added suites (status-style, booking validator, location-picker, status-legend, toolbar, bookings-table, detail-modal, `[id]` route) — **117 tests pass**.

## Summary table

| # | Severity | Area | Finding | File |
|---|----------|------|---------|------|
| 1 | **P1** | Correctness | Selecting a Nominatim result whose `display_name` > 240 chars stores a sliced address but leaves the **full** untruncated string in the input; the subsequent `onBlur` re-commits the full string, which the Zod `max(240)` then rejects with a 400 on save. | `components/ui/location-picker.tsx:110-118,155` |
| 2 | P2 | UX / consistency | Coordinate-only save still prepends an **optimistic** activity entry (`location · lat` / `location · lng`), but the server intentionally writes none (SILENT_KEYS). The entry flickers in then disappears on `refetchInlineActivity()`. Optimistic and server paths disagree. | `booking-detail-modal.tsx:507-521` |
| 3 | P2 | Accessibility | Table status pills use literal `text-white` on mid-luminance status fills. The lighter event-status fills (the former `--event-quoted` token was removed with the `quoted` status; the lightest remaining is `--event-cancelled` at oklch L≈0.60) still yield white-text contrast near or under the 4.5:1 AA threshold for the 12px label. | `bookings-table.tsx:150-154`, `globals.css:99` |
| 4 | P2 | Dead code (i18n) | `tabs.locationPlaceholder` is now orphaned in all 5 catalogs — its only consumer (the removed wizard `Input` placeholder) is gone. | `messages/*.json:397` |
| 5 | P2 | Dead code (i18n) | `calendar.filterActive` (with ICU `{status}`) was added to all 5 catalogs but is never consumed anywhere. | `messages/*.json` |
| 6 | P2 | Test coverage | No test exercises (a) the create-route lat/lng persistence path (no `app/api/bookings/route.test.ts` exists at all) or (b) the >240-char Nominatim `display_name` slice path (finding #1). | — |
| 7 | P2 | Perf (acceptable) | Legend filter does a full server round-trip per toggle (`router.push` → RSC refetch) rather than client-filtering already-loaded events. Deliberate (single source of truth, matches table view), wrapped in `startTransition`. Noted, not a defect. | `calendar-view.tsx:603-621` |

No P0 blockers found. The multi-tenant story is clean and the core lat/lng wiring is correct.

---

## Detail

### 1 — P1: Nominatim long-name select breaks save

`selectResult` truncates the persisted address to 240 chars but sets the visible query to the full name:

```ts
function selectResult(r: NominatimResult) {
  ...
  setQuery(r.display_name);                              // full, untruncated
  onChange({ address: r.display_name.slice(0, 240), lat, lng }); // sliced
}
```

`onBlur={() => commitAddress(query.trim())}` then fires when the input loses focus. Because `query` (full) `!== value.address` (sliced 240), `commitAddress` re-emits `onChange({ ...value, address: <full > 240> })`. That pending value is sent on save and rejected:
- detail modal PATCH → `bookingPatchSchema["location.address"] = z.string().max(240)` → **400**
- wizard create → `bookingCreateSchema.location.address = z.string().max(240)` → **400**

Nominatim `display_name` for detailed POIs/full addresses routinely exceeds 240 chars, so this is reachable with normal use. The user picks a valid suggestion and gets an opaque save failure.

**Fix:** truncate consistently — `setQuery(r.display_name.slice(0, 240))` (and/or slice inside `commitAddress`). Add a test with a `display_name` longer than 240 chars asserting the committed address length ≤ 240 and that a blur after select does not lengthen it.

### 2 — P2: optimistic activity entry for silent coordinate change

The server's `SILENT_KEYS` logic is correct: a coordinate-only PATCH persists lat/lng via `setOp` and writes **no** `ActivityLog` because `diff` is empty (`route.ts:146-157,277-286`). Verified by the new route tests (persist-without-log + address-only-logs-address). 

But the client `save()` builds `changes` from the full `pending` map and calls `prependOptimisticActivity("updated", changes)` unconditionally (`booking-detail-modal.tsx:507-521`). For a pin-only edit this prepends a temp entry rendered as `· location · lat` / `· location · lng`, which then vanishes when `refetchInlineActivity()` reconciles against the server (which logged nothing). Net effect: a brief, incorrect history flicker.

**Fix:** strip `location.lat`/`location.lng` from `changes` before `prependOptimisticActivity`, and skip the prepend entirely when `changes` is empty (mirror the server's SILENT_KEYS so the two paths agree). Reuse the same key set rather than duplicating the literals.

### 3 — P2: white-on-lighter-fill pill contrast

`bookings-table.tsx` renders the pill with `text-white` over `style={{ backgroundColor: STATUS_COLOR_VAR[v] }}`. The `--event-*` palette is mid-luminance and theme-invariant by design. Of the four active tokens — `--event-booked` (L≈0.55), `--event-inquiry` (L≈0.55), `--event-completed` (L≈0.55), `--event-cancelled` (L≈0.60) — the lightest is `--event-cancelled` (the former `--event-quoted` token was removed with the `quoted` status, which had been the outlier at oklch L≈0.68). White on `--event-cancelled` at L≈0.60 sits close to the 4.5:1 AA threshold for the 12px label and warrants verification. The calendar candle shares the same colors so the issue predates this branch, but the branch newly applies it to the table pill.

**Fix (low-effort):** verify `--event-cancelled` contrast; darken toward L≈0.55 if it falls short, OR drive pill text off a paired `--event-*-foreground` token instead of literal `text-white`. Per CLAUDE.md, literal `text-white` is also a (minor) raw-color deviation — a paired foreground token is the on-spec choice.

### 4 / 5 — P2: orphaned i18n keys

- `locationPlaceholder` (all 5 catalogs, line 397): consumer removed when the wizard `Input` became `LocationPicker`. The picker uses its own `locationPicker.searchPlaceholder`. Delete `locationPlaceholder` from all 5.
- `filterActive` (all 5 catalogs): added with an ICU `{status}` placeholder but never referenced. The legend only uses `filterByStatus`. Either wire it (e.g. as the active chip's `aria-label`/title to announce "Filtering by X — tap again to clear") or delete it from all 5. `shiftHint` removal was done correctly across all 5.

### 6 — P2: test gaps

- The create route POST persists `location.{lat,lng}` (`app/api/bookings/route.ts:114-118`) with no test file for that route — the new-field persistence and tenant-isolation of lat/lng on create are unverified. The PATCH route is well covered (persist, silent-log, out-of-range 400). Consider an `app/api/bookings/route.test.ts` mirroring the PATCH coverage.
- The LocationPicker "select" test uses a short `display_name`, so finding #1's truncation path is never exercised.

---

## Things checked and found correct (no action)

- **Multi-tenant safety:** every booking read/write still filters by `workspaceId` derived from `requireOrg()` (`route.ts` PATCH/POST, `bookings/page.tsx` `listBookings`). lat/lng are plain validated numbers in `$set` — no operator injection, no client-supplied workspaceId trust. The Booking model already declares `location.lat/lng` (`Number, default null`) so `$set` persists.
- **Zod bounds:** `lat ∈ [-90,90]`, `lng ∈ [-180,180]`, both `.nullable()`, create defaults to `null`. Enforced server-side on both create and patch; tests cover out-of-range rejection.
- **SILENT_KEYS persistence:** coordinate-only PATCH persists and writes no log; address+coords logs only the address. The `before === value` numeric short-circuit (`existing` is a hydrated doc, not lean) correctly skips true no-ops. Verified by tests.
- **Detail-modal null handling:** the `value` props for LocationPicker use `"key" in pending` checks (not `?? booking`), so a cleared pin (`null`) is not clobbered by the booking fallback. `commitField`/`getCurrentValue`/`applyChanges` round-trip `null` correctly (clearing then re-committing `null` drops the pending key as a no-op). Good — this was the trap called out in the brief and it's handled right.
- **Legend filter round-trip:** `?status=` is read server-side by `listBookings`; calendar `events` are derived from the filtered result. The client `activeStatus` memo only drives the chip's visual active state. Toggling the active status deletes the param (clears). Hiding the toolbar status dropdown in calendar view (`view="calendar"`) avoids two competing controls on the same param. Consistent.
- **LocationPicker async hygiene:** trailing-edge 450ms debounce, AbortController aborts the in-flight request on new keystroke and on unmount, `<3` chars never searches, AbortError is swallowed (not logged as error) while real errors are surfaced. `skipNextSearchRef` correctly suppresses the search that a programmatic `setQuery` (select/clear) would otherwise trigger. Effect deps `[query, disabled]` are correct. The microtask-deferred reset for short queries matches the app's existing cascading-render-lint workaround.
- **Map SSR/XSS:** `LocationMap` is `dynamic(..., { ssr: false })` so Leaflet never touches `window` during SSR. The divIcon HTML is a static SVG string with no interpolation — no XSS surface. Nominatim query is `encodeURIComponent`'d — no URL injection. Fair-use risk is documented in RELEASE-CHECKLIST §11.
- **Tabs active style:** `data-[selected]:border-brand/text-brand` is appended via `cn()` (twMerge), which correctly dedupes against the base `data-[selected]:border-foreground/text-foreground` and keeps the brand variant. The brand-accent active tab renders as intended.
- **Tailwind `z-1100`:** valid in Tailwind v4 (`z-<number>` dynamic utility → `z-index: 1100`). Not a bug.
- **Leaflet dark-mode re-pairing:** `globals.css` overrides container bg, zoom-bar controls, disabled state, attribution, and popup wrapper/tip to paired Gallurio tokens for both themes. Raster tiles intentionally untouched. Meets the third-party-CSS re-pairing rule.
- **i18n:** `client`/`event`/`pricing` tab keys, `locationPicker.*`, and `filterByStatus` present and consistent across all 5 catalogs with intact ICU placeholders; `shiftHint` removed from all 5.
- **Field preservation:** the Details→Client/Event/Pricing/Notes split keeps every editable field (clientName, status, title, eventType, location, sessions, amount.{total,deposit,currency}, notes) — nothing dropped.
- **Edit-diff:** wizard `buildEditDiff` and `buildCreatePayload` thread lat/lng; wizard defaults default them to `null`. Test fixtures updated to the `{address, lat, lng}` shape.

## Recommendation

Fix **#1 (P1)** before merge — it produces a user-facing save failure on a normal interaction. #2–#6 are P2 polish/cleanup that can ship in the same pass cheaply (all are small, localized edits). The architecture, multi-tenant scoping, and the trickier null-pin round-trip are sound.

---

## Resolution log (2026-05-28, same pass)

- **#1 (P1) — FIXED.** `selectResult` now slices `display_name` to 240 once and uses it for both the input value and the committed address; the search `Input` also gets `maxLength={240}` so free-typed addresses can't exceed the schema max either. Added a regression test asserting a 400-char name clamps to exactly 240 in both `onChange` and the input value (`location-picker.test.tsx`).
- **#2 (P2) — FIXED.** The detail modal's optimistic `changes` now skips `location.lat`/`location.lng` (mirroring the server `SILENT_KEYS`), and `prependOptimisticActivity` is skipped entirely when `changes` is empty — a coordinate-only save shows no phantom entry.
- **#4 (P2) — FIXED.** Removed the orphaned `wizard.event.locationPlaceholder` key from all 5 catalogs.
- **#5 (P2) — FIXED by wiring (not deletion).** `calendar.filterActive` is now consumed: the active legend chip sets `title={filterActive({status})}` for an accessible "Filtering by X — tap again to clear" hint.
- **#6 (P2) — FIXED.** A pre-existing `app/api/bookings/route.test.ts` did exist (the review missed it); extended it with three create-route cases — lat/lng persistence, null defaults, and out-of-range latitude → 400. The >240-char slice path is covered by the new picker test under #1.
- **#3 (P2) — DEFERRED (by design).** The lighter event-status fills (`--event-cancelled` at L≈0.60 being the lightest now that `--event-quoted` was removed) are pre-existing, deliberately theme-invariant tokens already used for calendar candles with white text since before this branch. Adjusting them would alter the established calendar color vocabulary — a design-owner decision, not a drive-by change. Tracked here for a separate, intentional accessibility pass on the event palette rather than silently changing shared design tokens.
- **#7** was explicitly noted as acceptable (deliberate single-source-of-truth round-trip).

Post-fix verification: `pnpm typecheck` clean, `pnpm lint` 0 errors, affected suites (picker, legend, detail-modal, create + `[id]` routes) — 61 tests pass.
