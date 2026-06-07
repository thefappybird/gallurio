# Code Review — Booking detail-modal redesign refinements

**Commit:** `09ddae0` — `feat(bookings): refine detail-modal redesign per review feedback`
**Branch:** `update/bookings/detail-modal-redesign`
**Reviewer:** Staff engineer (adversarial pass)
**Date:** 2026-05-30

## Verdict

**Ship-able after addressing the P1.** The change is well-scoped and the security-sensitive surface (the new `getClientById` query + `?client=` deep-link) is correctly tenant-isolated, ObjectId-validated, and index-backed. Tests, typecheck, and lint all pass:

- `pnpm typecheck` — clean
- `pnpm lint` — 0 errors (9 pre-existing warnings, none in this commit's files)
- `pnpm test` — 1108 passed / 1108

No P0 blockers. One P1 (deep-link does not re-open when the clients page is already mounted) and a handful of P2s.

## Summary table

| # | Severity | Area | File | Finding |
|---|----------|------|------|---------|
| 1 | P1 | State correctness | clients-page-client.tsx:56-57 | `?client=` deep-link only opens the modal on fresh mount; soft-nav / back-forward to a `?client=` URL while already on `/clients` is a no-op |
| 2 | P2 | Error handling | clients/page.tsx:133-139 | `getClientById` failure is swallowed and converted to a redirect-strip; a transient DB error silently discards a valid deep-link |
| 3 | P2 | Test quality | booking-detail-modal.test.tsx:186-199 | "Submit & discard proceeds with save" assertion is guarded by `if (submitDialogBtn)` — passes vacuously if the button is never found |
| 4 | P2 | A11y | components/ui/tabs.tsx (consumed here) | Reverted tabs lost the explicit `focus-visible:ring`; keyboard focus indicator on tabs is now only a subtle text-color shift |
| 5 | P2 | Consistency | status-pill.tsx:29 | `capitalize` + already-localized label can double-case non-English status labels and mis-case multi-word strings |

---

## Findings

### 1. P1 — Deep-link `?client=` does not re-open the modal when the clients page is already mounted

**File:** `app/[locale]/(app)/clients/_components/clients-page-client.tsx:56-57`

```ts
const [detailClient, setDetailClient] = useState<ClientRow | null>(initialDetailClient);
const [detailOpen, setDetailOpen] = useState<boolean>(!!initialDetailClient);
```

`initialDetailClient` is consumed **only** in `useState` initializers, and there is no `useEffect` syncing it. React `useState` initializers run once at mount; a later prop change is ignored. So:

- **Works:** cross-route navigation `/bookings → /clients?client=<id>` (the "View client" button's actual flow) remounts `ClientsPageClient`, so the modal opens. Tests cover this mount path.
- **Breaks:** any path where `ClientsPageClient` is already mounted and the `?client=` param changes via soft navigation — e.g. the user is on `/clients`, hits browser **Back** to a prior `/clients?client=<id>` history entry, or any future in-page link that pushes `?client=`. The server re-renders with a populated `detailClient`, but the client state ignores it and the modal stays closed. The URL then carries `?client=` with no visible modal — a confusing dead state that also survives until `stripClientParam` is never triggered (modal never opened → no close handler).

**Why it matters:** the feature's stated contract is "the `?client=` deep-link auto-opens the client detail modal." That contract silently holds only for the cold-mount case. Back/forward navigation is a first-class browser interaction.

**Recommended fix:** sync the deep-link into state with an effect keyed on the client id, so soft-nav updates re-open it and clearing the param closes it:

```ts
useEffect(() => {
  if (initialDetailClient) {
    setDetailClient(initialDetailClient);
    setDetailOpen(true);
  } else {
    setDetailOpen(false);
  }
}, [initialDetailClient?.id]);
```

(Guard against clobbering an open form/deactivate flow if those can coexist; in practice they `setDetailOpen(false)` already.) Alternatively, document explicitly that the deep-link is mount-only and acceptable for MVP — but the current code reads as if it supports live param changes (it strips the param on close via `router.replace`, implying URL/state are meant to stay in sync).

---

### 2. P2 — `getClientById` error is swallowed in a tenant-data path

**File:** `app/[locale]/(app)/clients/page.tsx:133-139`

```ts
try {
  found = await getClientById(workspace._id, sp.client);
} catch {
  // Unexpected error (e.g. transient DB failure) — treat as not-found and
  // strip the stale param rather than crashing the page.
  found = null;
}
if (found === null) {
  redirect({ href: { pathname: "/clients", query: cleanQuery }, locale });
}
```

CLAUDE.md: *"Never swallow an exception without either handling it meaningfully or rethrowing; a silenced error in a tenant-data path is itself a bug."* Here a transient DB failure is indistinguishable from a genuine not-found: both silently strip the param and redirect. The page still renders (the list was already fetched in `Promise.all` above), so the blast radius is limited to "the deep-linked modal silently doesn't open and the URL is rewritten" — but a real DB error gets masked rather than logged.

Note the catch is correctly placed: the `redirect()` (which throws `NEXT_REDIRECT`) is **outside** the try block, so the framework redirect is not swallowed. Good.

**Recommended fix:** narrow the catch to log the unexpected error before falling through, so observability isn't lost:

```ts
} catch (err) {
  console.error("getClientById deep-link failed", err);
  found = null;
}
```

Acceptable as-is for MVP given it's a read-only convenience path, but the silent-strip-on-DB-error should at minimum be logged.

---

### 3. P2 — Vacuous assertion in the "Submit & discard proceeds with save" test

**File:** `app/[locale]/(app)/bookings/_components/booking-detail-modal.test.tsx:178-199`

```ts
const submitDialogBtn = alertDialogActions.find(
  (btn) => btn.closest('[role="alertdialog"]') !== null && !btn.textContent?.match(/cancel/i)
);
if (submitDialogBtn) {
  fireEvent.click(submitDialogBtn);
  await waitFor(() => { /* expect 1 PATCH */ });
}
```

If `submitDialogBtn` is `undefined` (selector drift, dialog not rendered, role mismatch), the entire body is skipped and the test passes with **zero assertions**. CLAUDE.md mandates strict tests that try to break the feature; a self-disabling test gives false confidence on exactly the path it claims to verify (that confirming actually fires the PATCH).

**Recommended fix:** assert the button exists before clicking, so a regression that hides/relabels the confirm action fails loudly:

```ts
expect(submitDialogBtn).toBeDefined();
fireEvent.click(submitDialogBtn!);
await waitFor(() => expect(patchCalls).toHaveLength(1));
```

The companion test (clicking Save shows the dialog and fires **no** PATCH) is solid and not affected.

---

### 4. P2 — Tab keyboard focus indicator weakened by the revert

**File:** `app/[locale]/(app)/bookings/_components/booking-detail-modal.tsx:1561-1576` (consuming `components/ui/tabs.tsx:36`)

The redesign reverted the per-tab classes from the explicit bordered-pill style (which carried `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1`) to the base `TabsTab`, which only provides `focus-visible:text-foreground` (a subtle color shift) with no ring/outline. CLAUDE.md requires `hover:` paired with a visible `focus-visible:` so keyboard and touch users get identical, perceivable feedback. A text-color-only focus state on a tab that's already `text-muted-foreground → text-foreground` on hover may be hard to distinguish from hover and is a weak keyboard affordance.

`data-[selected]:border-brand` correctly wins over the base `data-[selected]:border-foreground` via tailwind-merge, so the active brand underline renders as intended — that part is fine.

**Recommended fix:** add a focus-visible ring to the base `TabsTab` (benefits all tab consumers) or to these four tabs, e.g. `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background`. Verify it doesn't clip against the `overflow-x-auto` list.

---

### 5. P2 — `capitalize` applied to an already-localized status label

**File:** `app/[locale]/(app)/bookings/_components/status-pill.tsx:29`

```tsx
className="... text-xs font-medium capitalize text-card-foreground"
...
const label = isKnown ? tStatus(status as BookingStatus) : status;
```

`label` is already the localized status string from `app.bookings.statusValues`. `capitalize` (CSS `text-transform: capitalize`) upper-cases the first letter of **every word**, which (a) is redundant if catalogs are already cased, and (b) mis-cases multi-word labels in any locale. For the unknown-status fallback it raw-cases a DB enum value like `draft` → `Draft`, which is fine, but the localized path shouldn't be force-transformed.

**Recommended fix:** drop `capitalize` and rely on the catalog casing, or apply it only to the unknown-status fallback branch. Low impact but it's a latent i18n correctness nit.

---

## Things checked and confirmed correct (no action)

- **Tenant isolation (`getClientById`)** — `Client.findOne({ _id, workspaceId })` plus `Booking.aggregate({ $match: { workspaceId, clientId } })`. Workspace id derived from `requireOrg()`, never from the client. Tenant-isolation test present and passing. No IDOR.
- **ObjectId validation** — `Types.ObjectId.isValid(clientId)` guards before constructing the id; invalid strings return `null` (tested). No cast-injection.
- **Index backing** — the stats aggregate `$match: { workspaceId, clientId }` is backed by `bookingSchema.index({ workspaceId: 1, clientId: 1 })`; `findOne` by `_id` + `workspaceId` is backed by the default `_id` index. No new scan introduced.
- **Redirect loop** — not-found strips `client` and redirects to a query without it; the follow-up request has no `sp.client`, so no loop.
- **Inactive / off-page deep-link** — `getClientById` does not filter by `isActive` or pagination, so an inactive or off-page client still resolves and opens. Correct.
- **`StatusPill` unknown-status fallback** — `draft` (not in `BOOKING_STATUSES`) and any unknown string render the raw label with no color dot rather than throwing. Wizard gates the pill on `!loading && values.status`. Detail header always has a real status. Safe.
- **Save guard / discard flow** — `save()` → guard → `runSave()`; `confirmSubmitDiscardDrafts()` closes the dialog then calls `runSave()`. `runSave` pushes only `lockedDrafts` into `mergedSessions` and clears all drafts (`setDraftSessions([])`) on success, so unconfirmed drafts are genuinely discarded. Error path rolls back booking/activity/drafts/edits. `onSave: () => void` — no caller awaits the now-sync `save`.
- **i18n completeness** — `viewClient`, `unconfirmedDrafts.{title,description,submit,cancel}`, `editTitleNamed` present in all 4 active locales. ICU plural uses `{count, plural, one {…#…} other {…#…}}` with correct `#`; trailing prose lives inside the single message (no fragment concatenation).
- **Design rules** — `StatusPill` uses `border border-border bg-card text-card-foreground`, no `rounded-*`, semantic tokens only, status color via the shared `STATUS_COLOR_VAR` CSS vars (no raw colors). Sharp edges preserved.
- **Touch targets / paired states** — "View client" and "Change client" buttons are `min-h-11` with paired `hover:`/`focus-visible:` and `disabled:` styling; View client shows a real `Loader2Icon` spinner during navigation and has `aria-label`.
