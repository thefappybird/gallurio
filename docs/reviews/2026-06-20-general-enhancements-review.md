# Code Review — general-enhancements (2026-06-20)

**Scope:** `git diff 7f60a10..HEAD` — four commits:

- `76ed6d7` feat(sidebar): collapsed bell visibility, bell active state, spacing, theme highlight, bell nudge
- `71892aa` feat(location-picker): inline `[input][x][check]` buttons + enable logic
- `ae1620d` fix(inquiries): strip `inquiryId` on convert so modal stays closed
- `f788024` feat: remove workspace branding + custom-domain features

Reviewed against the 9 tasks/decisions in the brief. The auth-refactor commit `7f60a10`
was explicitly excluded. Dependencies are not installed in this worktree
(`node_modules/vitest` absent), so findings are from static analysis + reading
surrounding code; the suite could not be executed here.

---

## Summary

The branding/custom-domain removal is broad and, with one exception, clean: no
dangling `workspace.branding` references remain in app/lib source, the page-builder
brand kit (`publicPage.brandKit`, `BrandKitPicker`, theme grid, onboarding brand-kit
review) is preserved, locale key removals are identical across all 4 locales, and the
SEO fallbacks/seed/onboarding-step wiring were updated consistently. Sidebar bell,
theme highlight, inquiry-convert, and location-picker changes are correct and
well-tested.

Two real issues stand out: a **stale test** that asserts a now-removed model field
(will fail the suite), and a **Pro-plan inconsistency** where `removeBranding` was
dropped from the plan feature list while the plan copy still advertises it and the
brief required it to stay.

---

## Critical

### C1. `publicPage.test.ts` asserts removed `branding` field — test will fail
**File:** `lib/db/queries/publicPage.test.ts:214` (also seeds it at `:189`)

This test file was **not** updated as part of the branding removal. It still does:

```ts
expect(doc.branding).toBeDefined();
```

`Workspace.branding` was deleted from the schema (`lib/db/models/Workspace.ts`) and
the projection in `findPublishedWorkspaceBySlug` changed from
`.select("slug name country branding publicPage contact")` to
`.select("slug name country publicPage contact")` (`lib/db/queries/publicPage.ts:34`).
The `branding: {...}` passed to `Workspace.create` at line 189 is now an unknown field
that Mongoose strips, and it is no longer projected — so `doc.branding` is `undefined`
and the assertion fails. This breaks `pnpm test`, contradicting the Done criteria
("tests are added and passing").

**Fix:** remove the `branding: {...}` block at lines 189–192 and delete the
`expect(doc.branding).toBeDefined();` assertion at line 214 (the surrounding test is a
projection test for public fields; `branding` is no longer a public field).

---

## High

### H1. Pro plan: `removeBranding` feature dropped, but copy still advertises it (and brief says keep it)
**Files:** `lib/paddle/plans.ts:61-65`, `messages/{en,fil,ms,id}.json:1693`,
`messages/en.json` pro `description`/`tagline`

The Pro `featureKeys` array lost **two** entries: `customDomain` (correct) and
`plans.pro.features.removeBranding` (problematic). After the change:

- The brief (task 5 / task 6) states the page-builder brand-kit feature
  `plans.pro.features.removeBranding` **MUST remain intact** — only the workspace
  branding form and custom domain were in scope for removal. "Remove Gallurio
  branding" is the public-page watermark entitlement, unrelated to the workspace
  branding form that was removed.
- The Pro `description`/`tagline` were rewritten to **`"Invoices + remove branding."`**
  while the feature row that renders "Remove Gallurio branding" was removed from the
  catalog — so the plan card advertises a benefit it no longer lists.
- The locale key `plans.pro.features.removeBranding` is now **orphaned** in all four
  message files (line 1693) — present but referenced by no code.

**Fix:** restore `"plans.pro.features.removeBranding"` to the Pro `featureKeys` array
in `lib/paddle/plans.ts` (keep `customDomain` removed). That re-uses the existing
locale key and makes the card consistent with its own tagline. If instead the intent
was truly to drop the watermark feature, then the four `removeBranding` locale keys
and the "remove branding" tagline/description must also be removed — but that
contradicts the brief, so restoring the feature key is the expected fix.

---

## Medium

_None._

---

## Low

### L1. `WorkspaceSwitcherItem.logoUrl` is now always `null` and never rendered
**Files:** `app/[locale]/(app)/settings/[[...catchall]]/page.tsx:84` (maps
`logoUrl: null`), `app/[locale]/(app)/settings/_components/settings-org-switcher.tsx:21`
(field declared but unused in render)

With workspace logos gone, `logoUrl` is hard-coded to `null` at the call site and the
switcher component never reads it. Harmless, but it is now dead data/shape.

**Fix (optional):** drop `logoUrl` from `WorkspaceSwitcherItem` and from the `.map()`
in `page.tsx`. Same for the sidebar `workspaceLogoUrl` prop, which is now always
`null` (`app/[locale]/(app)/layout.tsx:55`) — the `AppSidebar` logo branch
(`app-sidebar.tsx:121-125`) is now permanently the initial fallback. The fallback is
wired cleanly; the prop is simply vestigial.

---

## Nit

### N1. Bell nudge cannot restart while an animation is in flight
**File:** `components/app/app-sidebar.tsx:91-96, 159-160`

If a second `notification:new` arrives while `bellNudge` is already `true`,
`setBellNudge(true)` is a no-op (state unchanged) so the swing does not replay. The
ref-based "no false nudge on load" init is correct (the ref captures the SSR
`initialUnreadCount` on first render). Acceptable for a 600ms decorative animation;
note only.

### N2. Deprecated location-picker labels still wired through `IntlLocationPicker`
**File:** `components/ui/location-picker.tsx:64-69, 509-511`

`accept`, `cancel`, `apply`, and `clear` are marked `@deprecated` and are no longer
used in render (the in-field clear was removed; accept/discard now use
`acceptLocation`/`discardLocation`). `IntlLocationPicker` still calls `t("accept")`
etc., and the keys still exist in all four locales, so nothing throws — but the
deprecated keys/labels are now dead weight.

**Fix (optional):** drop the deprecated label props and their `t()` lookups, and
remove the now-unused locale keys.

---

## Verified correct (no action needed)

- **Task 1 — collapsed bell visibility:** the icon wrapper gets
  `group-data-[collapsible=icon]:inline-flex!` to override the collapse rule that
  hides direct-child `<span>`s; the label `<span>{tNotif("bell")}</span>` still
  collapses. Badge keeps `absolute -top-1 -right-1` positioning inside the
  `relative` wrapper. (`app-sidebar.tsx:157-171`)
- **Task 2 — bell active state:** `usePathname` is imported from
  `@/lib/i18n/navigation` (locale-stripped), so `pathname === "/notifications"` and
  the `startsWith("/notifications/")` check are correct; also active when
  `bellOpen`. (`app-sidebar.tsx:5,147`)
- **Task 3 — spacing:** `gap-1` added to the three `SidebarMenu` instances.
- **Task 4 — theme highlight:** styling uses `data-[active=true]:...`, not attribute
  presence; React renders `data-active={false}` literally as `data-active="false"`,
  so only the selected item matches. Test asserts both `true` and `false` cases.
  (`theme-toggle.tsx:57-58`, `theme-toggle.test.tsx`)
- **Task 5 — workspace branding removal:** model field, `User` onboarding step,
  validators (`brandingStepSchema`, `updateWorkspaceBrandingSchema`, `hexColor`),
  settings action + form, onboarding action/route/illustration/step-shell, SEO
  fallbacks, seed coupling, page-builder `RenderWorkspace.branding` +
  `buildRenderWorkspace` + template `seedData` arg + `useWorkspaceBranding` shortcut,
  and all 4 locales removed consistently. No dangling `workspace.branding` in
  app/lib source. The historical migration `lib/db/migrations/2026-05-portfolio-page-shape.ts`
  reads `doc.branding` off raw docs via a `Record<string, unknown>` cast — correct to
  leave (it migrates old-shape data). Page-builder brand kit preserved. Sidebar logo
  fallback to initial is wired cleanly.
- **Task 6 — custom domain removal:** model field, settings input, locale keys, and
  `plans.pro.features.customDomain` removed; Pro copy no longer mentions custom
  domain. (See H1 for the `removeBranding` over-removal.)
- **Task 7 — inquiry convert:** `handleConverted` resets `hasChanges` (no duplicate
  refresh), closes the modal, then `stripInquiryParam()` does a `router.replace`
  removing `inquiryId` so the post-`revalidatePath` re-render supplies a null
  `initialDetail` and the deep-link sync block does not reopen the modal. `onConverted`
  fires before the awaited server action, and `booking-draft-card` skips its own
  `router.refresh()` when `onConverted` is present — no double refresh. Optimistic
  `status: "booked"` patch applied. Covered by a new test.
- **Task 8 — location picker layout:** inline `[input][x][check]`; in-field clear and
  its `clear()` handler removed; autocomplete `<ul>` moved inside the input container;
  `searchWrapperRef` kept on the outer `relative` wrapper for focus-into-edit. (The
  dropdown's lack of an outside-click close is pre-existing behavior, unchanged.)
- **Task 9 — enable logic:** accept `disabled={disabled || !hasDraftLocation || !dirty}`
  (enabled only with a draft location AND dirty); discard
  `disabled={disabled || (!hasSavedLocation && !dirty)}` (disabled only when no saved
  location AND not dirty). Matches spec. Bell nudge initialized from SSR
  `initialUnreadCount` via `useRef`. `prefers-reduced-motion` disables the animation.
  Covered by three new tests.
- **Styling:** new bell-nudge CSS uses transforms only; theme highlight uses
  `bg-brand/12 text-brand` (semantic brand token), no raw colors.
- **vitest.config.ts:** the `next/cache` alias uses `require.resolve`, consistent with
  the existing `__dirname` usage (Vite loads the config in a CJS context). Fine.
