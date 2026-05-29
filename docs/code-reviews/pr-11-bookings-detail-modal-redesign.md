# Code Review — PR #11 `update/bookings/detail-modal-redesign`

**Verdict: REQUEST CHANGES (no Blockers; several High/Medium correctness + UX issues)**

| Field | Value |
|---|---|
| PR | #11 |
| Branch | `update/bookings/detail-modal-redesign` |
| Base | `dev` |
| Head SHA | `0cd7bdd56ac33356609caa699b953bd2d00b3087` |
| Review date | 2026-05-30 |
| Reviewer methodology | Full `git diff dev...HEAD` read end-to-end; surrounding unchanged source (PATCH handler, `/api/clients` route, `commitField`/`discardField`/`save`/`applyChanges`/`getCurrentValue`, `EDITABLE_KEYS`, `Client` model indexes, `formatMoney`, existing review format) read for context. Adversarial: tried to break each new surface (reassign on multi-session, post-save client desync, UTC day bucketing, out-of-order search, midnight staleness). No fixes applied — review only. |

The backend changes are genuinely solid: the GET `client` block is `{_id, workspaceId}`-scoped with a tight projection, and the reassign PATCH (pre-existing, exercised by the new picker) validates the target `clientId` belongs to the workspace, blocks multi-session reassignment, and wraps the financial reconciliation + activity log in a Mongo transaction. The five-locale catalogs are complete and key-aligned. The problems are concentrated in the **client-tab UI ↔ data desync after save**, a **UTC vs. local day-bucketing bug in the timeline**, a **missing client-side guard for the multi-session reassign 422**, and **hardcoded English `aria-label`s / `aria-label`s + a search-error string that bypass i18n**.

---

## Findings (by severity)

### High

#### H1 — Client contact block silently loses email/phone after any save (data desync) · confidence 85
**File:** `app/[locale]/(app)/bookings/_components/booking-detail-modal.tsx` (client tab block ~`1501–1517`; `save()` `setBooking(updated)` ~`561`; PATCH response `app/api/bookings/[id]/route.ts:~305` returns `Booking.findOne(...).lean()` with **no** `client` block)

The new client tab renders contact info from `booking.client`:
```tsx
{booking.client?.name ?? booking.clientName}
{booking.client?.email ? <a href={`mailto:…`}>…</a> : <span>{tFields("noEmail")}</span>}
{booking.client?.phone ? <a href={`tel:…`}>…</a> : <span>{tFields("noPhone")}</span>}
```
But `client` is only ever populated by the **GET** route. The **PATCH** route returns the raw booking (`Booking.findOne(...).lean()`) with no `client` key, and `save()` does `setBooking(updated)`. After *any* successful save (even an unrelated title/price edit), `booking.client` becomes `undefined`, so the contact block collapses to the bare `clientName` and shows **"No email" / "No phone"** for a client that has both. The email/phone only reappear on modal reopen (fresh GET).

This violates the optimistic-rendering contract in CLAUDE.md ("on success the UI stays") and the four-states rule — a populated surface degrades to a false "empty" state with no user action.

**Fix:** Either (a) preserve the existing `client` block across PATCH by merging — `setBooking((prev) => ({ ...updated, client: prev?.client ?? null }))` — when the save did not change `clientId`; or (b) have the PATCH response attach the same `client` block the GET builds. (a) is cheaper and avoids an extra query.

#### H2 — Optimistic reassign leaves stale email/phone (and the same post-save collapse) · confidence 80
**File:** `booking-detail-modal.tsx` reassign `onSelect` (~`1545–1551`), `applyChanges` (~`2920–2944`), `getCurrentValue` (~`2900`)

Reassign stages `clientId` + `clientName` together (good — they're committed as a pair, and `discardAll` clears both). But `applyChanges` only writes scalar keys onto `next` — it sets `next.clientId`/`next.clientName` via the `else` branch and **never updates `next.client`**. So between commit and save, the contact block shows the **new name** (`booking.client?.name ?? booking.clientName` falls through to `clientName`) but the **old client's email/phone** (still in `booking.client`). After save, H1 then wipes them entirely. The staged optimistic state is internally inconsistent.

**Fix:** When staging a reassign, also stage the picked client's `email`/`phone` into a local `client` snapshot (the picker already has `ClientSearchHit` with both), and have `applyChanges` rebuild `next.client` when `clientId`/`clientName` are present. Combine with H1's PATCH-merge so the snapshot survives the save.

#### H3 — No client-side guard for multi-session reassign → staged change always 422s · confidence 78
**File:** `booking-detail-modal.tsx` `ClientReassignPicker` render gate (`reassignOpen ? …`, ~`1542`); server guard `app/api/bookings/[id]/route.ts:~98` (`"Cannot change client on a multi-session booking"`, 422)

The PATCH **correctly** rejects reassigning the client on a booking with `sessions.length > 1` (422). But the UI exposes the "Change client" button and picker unconditionally. On a multi-session booking the user can search, select a client, see the Save button arm, click Save — and only then get a toast error, with the staged reassign stuck in `pending` until they `discardAll`. CLAUDE.md: "empty/error states … recoverable" and "fail loudly in dev and gracefully in prod" — this is a foreseeable, preventable failure surfaced too late.

**Fix:** Hide or disable the "Change client" affordance when `booking.sessions.length > 1`, with an inline caption explaining why (and translate it). Keep the server guard as defense in depth.

---

### Medium

#### M1 — Timeline day-bucketing mixes UTC and local time → wrong "Today"/"Yesterday" near midnight · confidence 72
**File:** `app/[locale]/(app)/bookings/_components/activity-timeline.tsx` `isoDate` (`12–14`), grouping (`today`/`yesterday` `~150–172`), per-entry time (`toLocaleTimeString`, `~196`)

```ts
function isoDate(date: Date): string { return date.toISOString().slice(0, 10); } // UTC day
const today = isoDate(nowRef);
const dayKey = isoDate(new Date(entry.createdAt));            // UTC day
…
time = new Date(entry.createdAt).toLocaleTimeString(locale, …) // LOCAL time
```
Day grouping uses the **UTC** calendar day while the displayed timestamp uses the **local** timezone. In PH (UTC+8) an event at 09:00 local on the 30th is `01:00Z` on the 30th — fine. But an event at 06:00 local (`22:00Z` on the 29th) gets bucketed under the 29th and may render under "Yesterday" while showing a 06:00 time that the user knows is *this morning*. For negative-offset locales the skew flips the other way. Two entries minutes apart can land in different day groups. CLAUDE.md i18n correctness + "easy on the eyes": the header and the time must agree.

**Fix:** Bucket by the **local** calendar day, not UTC. Derive `YYYY-MM-DD` from the locale-rendered date (e.g. `new Intl.DateTimeFormat('en-CA', { timeZone, year, month, day }).format(date)` or build the key from `toLocaleDateString` parts) so grouping and the displayed time share one timezone basis. Ideally key off the **workspace** timezone (the rest of the bookings feature is workspace-tz-aware), not the browser's.

#### M2 — Hardcoded English strings bypass i18n (multiple) · confidence 88
**Files:** `booking-detail-modal.tsx` and `activity-timeline.tsx`

CLAUDE.md: "A feature with English-only strings is unfinished … no hardcoded user-facing strings in the changed TSX." Several leaked:

- `booking-detail-modal.tsx` header: `aria-label="Confirm title"`, `aria-label="Cancel title edit"`, `aria-label={`Edit title: ${effectiveTitle}`}`, `aria-label={`Event type: ${eventTypeLabel}`}` (~`1158–1213`). `aria-label`s are user-facing for screen-reader users.
- `booking-detail-modal.tsx` client block: `aria-label={`Email ${booking.client.email}`}`, `aria-label={`Call ${booking.client.phone}`}` (~`1506`, `~1517`).
- `booking-detail-modal.tsx` `ClientReassignPicker`: `setSearchError("Search failed. Try again.")` (~`2680`) and the thrown `new Error("Search failed")` message — the former renders directly to the user as `searchError`. This is the *only* visible error string in the new picker and it's English-only.
- `activity-timeline.tsx`: `aria-label="Activity timeline"` (`~175`) and `aria-label` is absent — wait, the `<ol aria-label="Activity timeline">` is hardcoded English.

**Fix:** Route every one of these through the existing `t*` namespaces and add the keys to all five catalogs (the catalogs already grew this PR, so this is a consistency miss, not a structural one).

#### M3 — Debounced search has no request-sequencing guard → out-of-order results possible · confidence 60
**File:** `booking-detail-modal.tsx` `ClientReassignPicker` effect (`~2655–2700`)

The `cancelled` flag prevents a *superseded* fetch from writing state, because the cleanup runs and sets `cancelled = true` before the next effect run. That covers the common case. However, the guard relies solely on effect teardown ordering — there is no per-request id (`reqIdRef`) like the conflict-check effect elsewhere in this same file uses. If two debounce timers ever resolve in an interleaving the cleanup doesn't strictly serialize (e.g. a fast follow-up that doesn't retrigger the effect, or future refactors), a stale result could land. Given the 250 ms debounce and that each keystroke retriggers the effect (new cleanup → `cancelled = true`), this is **currently** safe — flagging as latent risk + inconsistency with the established `reqIdRef` pattern two functions up.

**Fix (optional/defensive):** Mirror the existing `reqIdRef` monotonic-id pattern, or document why teardown-cancellation alone is sufficient here.

#### M4 — `ChangePill` truncation likely ineffective; full text only reachable via hover (no touch path) · confidence 55
**File:** `activity-timeline.tsx` `ChangePill` (`~95–119`)

```tsx
<span title={content} className="inline-flex max-w-[200px] shrink-0 items-center truncate border … ">{content}</span>
```
`truncate` (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`) applies to the element's own text, but on a flex container the intended ellipsis often doesn't clip as expected without `min-w-0` / `block`. More importantly the full value is only exposed via the native `title` tooltip, which **does not appear on touch** — CLAUDE.md: "Tap-to-reveal beats hover-to-reveal on touch" and "color is never the only signal." A truncated `Total: ₱5,000 → ₱8,000…` on a 375px screen gives mobile users no way to see the full value.

**Fix:** Verify truncation actually clips (add `min-w-0`/`block` or wrap the text in an inner `<span className="truncate">`), and consider allowing wrap on small screens or a tap-to-expand instead of relying on `title`.

---

### Low

#### L1 — Long-open timeline goes stale across midnight (`useState(() => new Date())`) · confidence 65
**File:** `activity-timeline.tsx` `const [nowRef] = useState(() => new Date());` (`~133`)

`nowRef` is captured once at mount and used for the today/yesterday boundary. A modal or history dialog left open across midnight keeps labeling the new day's entries as "Yesterday"/"Today" relative to the mount time. The timeline is read-only and re-fetched on reopen, so impact is low — but the comment "Capture 'now' once … so it's not called during every render pass" conflates *render-loop avoidance* with *correctness*; the value is genuinely time-sensitive. Combined with M1 (UTC bucketing), the day logic is the weakest part of this component.

**Fix:** Acceptable to leave for now given read-only + short-lived usage; if addressed, recompute the boundary from a `useMemo` keyed on the entry set, or accept a coarse refresh. Document the staleness tradeoff.

#### L2 — "Open client" link points to `/clients`, not the specific client · confidence 70
**File:** `booking-detail-modal.tsx` client block `<Link href={`/clients`}>` (~`1527`)

The link is gated on `booking.client` existing and is labeled `openClient` ("Open client"), implying it opens *that* client. It actually drops the user on the unfiltered clients list. Whether this is acceptable depends on whether a `/clients/[id]` route exists. The test even asserts only `toHaveAttribute("href")` without checking the value — so it would pass even if the href were wrong (see T2). At minimum the label over-promises.

**Fix:** If a client detail route exists, link to `/clients/${booking.client.id}`. If not, either relabel to "View clients" or deep-link with a query param the clients page consumes (`/clients?focus=${id}`). Confirm intended behavior before shipping.

#### L3 — `clientId` change recorded in timeline maps to "clientName" label, but a pure clientName edit and a reassign are indistinguishable · confidence 45
**File:** `activity-timeline.tsx` `diffKeyToI18n` (`clientName → clientName`, `clientId → clientName`) (`~30–43`)

Both `clientId` and `clientName` diff keys render under the same "Client name" label. For a reassign the server logs `action: "client_changed"` with `meta.from/to` and a `clientName` before/after diff, so the pill reads sensibly. But if a future diff carries both keys, two near-identical pills render. Minor; noting because the mapping is lossy by design.

**Fix:** None required now; if duplicate pills appear in practice, dedupe `clientId`/`clientName` to a single pill.

---

### Nit

#### N1 — `ACTION_STYLES` uses `bg-[var(--brand)]/10` raw-var syntax instead of the `bg-brand` token · confidence 50
**File:** `activity-timeline.tsx` `ACTION_STYLES.created` (`~52–55`)

```ts
pill: "border-[var(--brand)]/40 bg-[var(--brand)]/10 text-[var(--brand)]",
```
Elsewhere in this very PR the header pill uses the semantic `bg-brand/10 … text-brand` form. Both compile, but CLAUDE.md prescribes the semantic token pair (`bg-brand` ⇄ `text-brand-foreground`). The arbitrary-value `var(--brand)` form is inconsistent and skips the paired-foreground guarantee (here it uses `text-[var(--brand)]` on a `/10` tint, which is fine for contrast but bypasses the convention).

**Fix:** Use `border-brand/40 bg-brand/10 text-brand` for parity with the header pill.

#### N2 — Empty comment block / dead branch in PATCH transaction · confidence 40
**File:** `app/api/bookings/[id]/route.ts` (`~208–210`, pre-existing but adjacent)
```ts
if ("sessions" in setOp) { // already included in setOp }
```
A no-op `if` with only a comment. Pre-existing, not introduced here, but it sits in the reassign path the new picker exercises. Optional cleanup.

#### N3 — `safeT`/try-catch around `next-intl` lookups is belt-and-suspenders · confidence 30
**File:** `activity-timeline.tsx` (`formatValue`, action label, change label — multiple `try/catch`)

`next-intl`'s `t()` does not throw on a missing key by default (it returns the key / a fallback marker depending on config), so the numerous `try { t(...) } catch { … }` blocks are likely dead `catch` arms. Harmless, but it's defensive noise; if the project's `onError` is set to throw, then they're load-bearing — worth confirming which.

---

## Tests review

The tests are **above average** for this codebase and assert real behavior, but have gaps:

**Good:**
- `route.test.ts` adds a genuine **tenant-isolation** test (org B booking → 404, no client leak) — mandatory per CLAUDE.md and correctly written. Also covers the orphaned-client (`client: null`) path and the populated `client` block shape. ✔
- `activity-timeline.test.tsx` asserts **translated** status/event labels (not raw enums), money formatting (`5,000 → 8,000`), the sessions label-only pill, em-dash for null, and day-grouping (Today/Yesterday, single vs. multiple headers). These would fail if the formatting/grouping logic broke. ✔
- `booking-detail-modal.test.tsx` covers inline-title Enter-stages / Escape-cancels, the event-type pill presence, the contact block email/phone, No email/No phone, and reassign-staging arming Save. ✔

**Gaps / weak assertions:**
- **T1 (would-pass-if-broken):** No test covers **H1** — that the contact block survives a save. A test that edits the title, saves, and asserts the email is *still shown* would fail today and pin the regression.
- **T2 (weak assertion):** `"shows the Open client link with the client id"` asserts only `expect(link).toHaveAttribute("href")` — it does **not** check the value, so it passes whether the href is `/clients`, `/clients/abc`, or `#`. Per L2 this is exactly the thing in question. Assert the concrete expected href.
- **T3:** No test for the **multi-session reassign 422** (H3) — neither the absence of a client-side guard nor the error surfacing. A test rendering a 2-session booking and asserting the "Change client" affordance is hidden/disabled would lock in the H3 fix.
- **T4:** No test for the search **error state** in `ClientReassignPicker` (fetch `!ok`) — the picker has loading/empty/results/error four-state branches but only loading→results is exercised. The M2 hardcoded error string ships untested.
- **T5:** Timeline day-bucketing tests use `new Date().toISOString()` for "today", so they implicitly assume UTC==local in the test env and would **not** catch the M1 UTC/local skew. A fixed-clock test at a near-midnight local time would expose it.
- **T6:** The modal `makeFetch` mock returns the same `MOCK_BOOKING` for PATCH (`patchResponse = booking`) — which *includes* a `client` block — so the test mock **masks H1** (real PATCH responses omit `client`). The fixture is more generous than the real API; a test using a realistic PATCH response (no `client`) would surface the desync.

---

## Convention compliance (CLAUDE.md)

- **Multi-tenant safety:** GET client lookup is `{_id, workspaceId}` + projection ✔. PATCH reassign validates target `clientId` ∈ workspace, 422s multi-session, transaction-wraps reconciliation + log ✔. `/api/clients` search is workspace-scoped, regex-escaped, limit-capped (≤1000; picker uses 20) ✔. **No tenant-safety defects found.**
- **Indexes:** GET lookup is an `_id` equality (always indexed) refined by `workspaceId` — no new index needed ✔. `/api/clients` `$or:[name,email]` regex sort-by-name is backed by `{workspaceId:1,name:1}`; the email-regex branch is a partition scan but bounded by workspace + limit — acceptable, not a full-collection scan ✔.
- **No N+1:** GET does one extra `findOne` for the client (not in a loop) ✔.
- **Sharp edges / tokens:** No `rounded-*` introduced ✔. Tokens semantic except N1 (`var(--brand)` arbitrary form).
- **Paired hover/focus-visible + ≥44px:** Tabs are `min-h-11` with paired `hover:`/`focus-visible:`/`active:` ✔. Title/reassign buttons pair hover+focus-visible ✔.
- **i18n five-locale parity:** All five catalogs got the same keys (`email`, `phone`, `openClient`, `changeClient*`, `noEmail/noPhone/noClientResults`, `history.actions.*`, `today`, `yesterday`) — verified aligned ✔. **But** several `aria-label`s + the search-error string are hardcoded English (M2) ✖.
- **Optimistic rendering:** Reassign stages locally and fires on Save — but the optimistic state is inconsistent (H2) and collapses post-save (H1) ✖.
- **Tests alongside code:** Present and mostly meaningful, with the gaps above (T1–T6).

---

## What's good (brief)

- The GET `client` block is exemplary: workspace-scoped, projected to exactly four fields, `null`-safe for orphaned bookings, with a matching tenant-isolation test.
- Extracting `ActivityTimeline` as a shared component used by both the inline tab and the history dialog removes real duplication and centralizes the diff-key→i18n mapping and money formatting.
- The header inline-title edit integrates cleanly with the existing `commitField`/`discardField`/`pending` mechanism (Enter commits, Escape discards-pending, pending-dot indicator), and the event-type pill reuses the same path.
- Five-locale catalogs were updated together and are key-aligned — the structural i18n discipline is correct (the misses are a handful of inline `aria-label`s, not missing catalog keys).
- Tests genuinely assert translated output and formatting, not just "renders without crashing."

---

## Summary

| Severity | Count |
|---|---|
| Blocker | 0 |
| High | 3 |
| Medium | 4 |
| Low | 3 |
| Nit | 3 |
| **Total** | **13** |

**Merge gate:** Resolve H1–H3 (post-save client desync, optimistic reassign inconsistency, multi-session guard) and M1–M2 (UTC day-bucketing, hardcoded English strings) before merge. Add the missing tests T1/T3/T6 (they pin the High findings). The backend and tenant-safety story is clean.
