# SSR interactivity audit — findings

Full-app inventory of every SSR-triggered render/fetch (route loads, dialogs,
dialog steps) per `docs/ssr-interactivity-agent-prompt.md`. This is **phase 1
only** — a findings/classification doc. No code changes are included here;
implementation is a separate, explicitly-gated follow-up once this doc is
reviewed and prioritized.

Classification legend: **#1** = trigger-scoped loading (button disables +
inline spinner). **#2** = whole-page loading (route `loading.tsx` and/or
skeleton). **either** = works either way, pick based on transition length.

**Headline finding: zero `loading.tsx` files exist anywhere under `app/`.**
All 25 `page.tsx` routes have no route-level fallback — every full navigation
is a silent wait today, masked only where an individual trigger button
happens to show its own pending state.

Existing reusable pieces to lean on in phase 2 (don't reinvent):
`components/ui/button.tsx` (`Button` has a native `loading` prop, used
correctly at most already-good call sites below), `hooks/use-guarded-action.ts`
(loading + concurrent-call guard), `components/app/table-skeleton.tsx`,
and the 4 optimistic-UI patterns documented in the `optimistic-rendering`
skill (**A** array-replace+resync, **B** patch-map+auto-prune, **C**
`useOptimistic`+reducer, **D** toast-loading-only).

---

## 1. Bookings

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| Wizard "Next" step-advance | booking-wizard-modal.tsx:902-921 | modal-step-advance | Disabled while `submitting`/`loadError`/conflict-check loading | either | spinner | Conflict fetch already reactive |
| Wizard edit-mode initial fetch | booking-wizard-modal.tsx:201-294, 794-798 | dialog-open | Plain centered `t("loading")` text, no skeleton | #2 | skeleton | Inconsistent with `BookingDetailModal`'s real skeleton |
| Wizard "Create"/"Save" (final submit) | booking-wizard-modal.tsx:922-945, 551-615, 673-692, 877-888 | modal-step-advance | `submitting` → spinner + disabled + text swap | #1 (already correct) | spinner | — |
| Session conflict check (date change) | booking-wizard-modal.tsx:321-386; sessions-location-step.tsx:256-261 | inline-mutation | Per-card spinner + "checkingConflicts"; Next disabled while any date loading | #1 (already correct) | spinner | Ad-hoc cache, Pattern-A-like |
| UnsavedChangesDialog "Discard" | unsaved-changes-dialog.tsx:49-56 | dialog-open | Instant state + `router.replace` in `startTransition`, `isPending` unused | either | none needed | — |
| Detail modal open (booking+activity fetch) | booking-detail-modal.tsx:392-439, 1314-1315, 3909-3917 | dialog-open | Real `<ModalSkeleton/>` | #2 (already correct) | skeleton | Good positive example |
| Detail modal "View client" | booking-detail-modal.tsx:379-390, 2154-2170 | inline-mutation | `viewClientLoading` → spinner icon, disabled | #1 (already correct) | spinner | — |
| Detail modal global "Save changes" | booking-detail-modal.tsx:710-717, 791-924, 3841-3853 | inline-mutation | Optimistic set before await, revert+toast on failure; spinner+disabled | #1 (already correct) | spinner | Close to Pattern B |
| Detail modal Cancel/Restore → confirm | booking-detail-modal.tsx:1225-1271; cancel-confirm-dialog.tsx:56-64 | inline-mutation | Optimistic status flip; confirm `loading={busy}` | #1 (already correct) | spinner | — |
| Detail modal "Download invoice/receipt" | booking-detail-modal.tsx:3787-3797, 3816-3825 | inline-mutation | `window.open()`, zero loading state, no double-click guard | #1 | spinner (brief) | Gap |
| Detail modal "View all history" → BookingHistoryDialog | booking-detail-modal.tsx:2807-2815; booking-history-dialog.tsx:43-91,119-124 | dialog-open | 5 stacked Skeleton rows | #2 (already correct) | skeleton | Good |
| BookingHistoryDialog Prev/Next | booking-history-dialog.tsx:141-160 | inline-mutation | Buttons disabled on loading; whole list re-skeletons per page | either | spinner on button (avoid full re-skeleton) | — |
| Session card commit (single-day inline edit) | booking-detail-modal.tsx:983-1006, ~3067-3080 | inline-mutation | Queued locally, spinner reflects conflict-check only | either | spinner | Persistence deferred to global Save |
| Session remove / multi-day date-shift | booking-detail-modal.tsx:931-974, 1014-1027, 1203-1208 | inline-mutation | Immediate PATCH, optimistic+revert; shares `saving` flag with unrelated global Save button | #1 | spinner (action-scoped) | Gap: no per-action isolation |
| SessionEditConfirmDialog "Apply to day"/"whole session" | session-edit-confirm-dialog.tsx:56-72; booking-detail-modal.tsx:1042-1108 | inline-mutation | Both buttons `loading={busy}` | #1 (already correct) | spinner | — |
| Calendar drag-to-reschedule/resize | calendar-view.tsx:322-384, 401-511 | inline-mutation | Optimistic move + `toast.promise`, dim/pointer-events-none while pending | either | none (adequate) | Pattern A+D hybrid |
| Calendar click event → open detail | calendar-view.tsx:263-277; page.tsx:261-277 | route-nav | Plain `router.push`, zero feedback until modal's own fetch resolves | #1 or #2 | spinner/dim on candle | Double round-trip, neither indicated |
| Bookings table row click (desktop) | bookings-table.tsx:452-459 | route-nav | Same, no loading state | #1 | row dim/spinner | **Hover-only issue**: desktop `<tr>` lacks `role="button"`/`tabIndex`/`onKeyDown` (mobile cards have it) |
| Bookings table row actions "View"/"Edit" | bookings-table.tsx:239-248, 348-357 | route-nav | Same `router.push`, no loading state | #1 | spinner on menu item | — |
| Bookings ViewToggle (table⇄calendar) | view-toggle.tsx:42-59 | route-nav | Plain `router.push`, no transition at all | #2 | full-page/shell skeleton | — |
| Bookings toolbar filters | bookings-toolbar.tsx:107-131,148-207 | route-nav | Own `startTransition`, `isPending` never surfaced; sibling page's `isPending` only covers Prev/Next | #2 | skeleton (exists, needs reliable wiring) | Toolbar and table pending state live in different places |
| Bookings pagination Prev/Next | bookings-page-client.tsx:44-50,77-94 | route-nav | `useTransition`+`isPending` → `TableSkeleton` | #2 (already correct) | skeleton | Correctly wired |
| CSV import "Import" | csv-import-dialog.tsx:114-151, 404-413 | inline-mutation | `useGuardedAction` → `loading` | #1 (already correct) | spinner | — |

## 2. Inquiries

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| Inquiry table row click / view | inquiry-table.tsx:80-82,113-145,209-221,264-271 | route-nav | Plain `router.push`; server-populated detail, no client fetch fallback | #2 | full-page or row skeleton/dim | Architecturally unlike bookings (no client fetch to hide behind) |
| Inquiries calendar click event | inquiries-calendar-manager.tsx:144-155 | route-nav | Plain `router.push`, no feedback | #1 or #2 | candle dim/spinner | Same double round-trip as bookings calendar |
| Inquiries calendar drag-to-reschedule | inquiries-calendar-manager.tsx:161-258 | inline-mutation | Optimistic override map + `toast.promise`, `router.refresh()` on success | either | none (fine) | Pattern A+D hybrid |
| Inquiries status tabs | inquiries-page-client.tsx:208-214,250-274,343-351 | route-nav | `startTransition`; `isPending` correctly drives `TableSkeleton` | #2 (already correct) | skeleton | Correctly wired — contrast with bookings |
| Inquiries date-range Apply/Clear | inquiries-page-client.tsx:176-194 | route-nav | Same `isPending` → `TableSkeleton` | #2 (already correct) | skeleton | — |
| Inquiries pagination Prev/Next | inquiries-page-client.tsx:216-218,360-378 | route-nav | Same | #2 (already correct) | skeleton | — |
| Inquiries ViewToggle (table⇄calendar) | inquiry-view-toggle.tsx:42-59 | route-nav | No transition/pending at all | #2 | full-page/shell skeleton | Same fix as bookings' toggle |
| InquiryActions "Decline"/"Archive" | inquiry-actions.tsx:16-66 | inline-mutation | Shared `working` disables both buttons, no spinner; `router.refresh()` on success | #1 | spinner on clicked button | No optimistic patch — hard refresh instead |
| ClientInfoCard phone edit Save/Cancel | client-info-card.tsx:45-56,85-97 | inline-mutation | `saving` disables Save, no spinner | #1 | spinner | Pattern B when embedded in modal |
| BookingDraftCard "Save" | booking-draft-card.tsx:181-195,433-441 | inline-mutation | `loading={saving}`+disabled | #1 (already correct) | spinner | Pattern B |
| BookingDraftCard "Approve" (convert) | booking-draft-card.tsx:197-218,424-432 | inline-mutation | Optimistic set before resolve, revert+toast on error; `loading={approving}` | #1 (already correct) | spinner | Close to Pattern C |
| BookingDraftCard sessions editor (field edits + Save/Discard) | booking-draft-card.tsx:131-172,397-413 | inline-mutation | Per-field conflict fetch has NO indicator; Save text-swap only, no icon | #1 | spinner (both) | No request-id race guard, unlike wizard |
| `/inquiries/[id]` standalone page | inquiries/[id]/page.tsx:17-34 | route-nav (initial load) | Pure SSR, no `loading.tsx` | n/a | route-level skeleton | For slow `getInquiryWithDraft` queries |

## 3. Clients

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| "Add client" button | clients-toolbar.tsx:185-192 | dialog-open | Instant open, round-trip is on submit not open | either | n/a | — |
| Search input (debounced) | clients-toolbar.tsx:71-76 | route-nav | `startTransition`; toolbar itself shows nothing, parent shows `TableSkeleton` | #2 | skeleton (already wired) | — |
| Source select / tags multi-select / "Show Inactive" switch / Clear filters | clients-toolbar.tsx:104-184 | route-nav | Same `pushParams` mechanism | #2 | skeleton (already wired) | — |
| Pagination Previous/Next | clients-page-client.tsx:223-241 | route-nav | `startTransition`; buttons only `disabled` at range edges, no spinner | #2 (skeleton exists) | skeleton | Buttons show no pending affordance of their own |
| Row click / row-actions "View"/"Edit"/"Deactivate" | clients-table.tsx:135-159, 251-263, 369-374 | dialog-open | Instant, no round-trip | either | n/a | — |
| Row actions "Reactivate" | clients-table.tsx:148-159; clients-page-client.tsx:150-176 | inline-mutation | Per-row spinner via `reactivatingId`, `useGuardedAction` (Pattern D); `refreshPage()` after has no skeleton wired | #1 (button already done) | spinner (already correct) | Refresh-after gap |
| Client form modal submit | client-form-modal.tsx:108-121 | modal-step-advance | Text-only swap (`isSubmitting`), no spinner icon | #1 (already done) | spinner icon recommended | Inconsistent with rest of app |
| Detail modal tabs (Overview/Bookings/Payments) | client-detail-modal.tsx:139-144 | tab-switch | Bookings tab lazy-loads, shows 3 Skeleton bars | already correct | skeleton (already implemented) | Reference example |
| Detail modal footer "Reactivate" | client-detail-modal.tsx:271-280 | inline-mutation | Delegates to same handler as table row but shows **no** spinner in this location | #1 | spinner | Gap: zero feedback from this entry point |
| Deactivate dialog "Deactivate" | deactivate-client-dialog.tsx:77-86 | inline-mutation | `Button loading` (Pattern D) | already correct | spinner (already implemented) | — |

## 4. Teams

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| Search input / "Show deactivated" switch | teams-page-client.tsx:113-131, 218-228 | route-nav / local filter | Filtering is client-side `useMemo`, instant; URL push is bookkeeping only | either | none needed | No visible gap |
| "Invite"/"Create team" buttons, row → details, row-menu items | teams-page-client.tsx:230-241; teams-table.tsx:93-124, 221-227, 316 | dialog-open | All instant opens | either | n/a | — |
| CreateDialog / EditDialog submit | team-dialogs.tsx:102-139, 228-282 | modal-step-advance | `pending` via `useTransition`, spinner+disabled (Pattern C optimistic) | already correct (#1) | spinner (already implemented) | **Gap**: optimistic row shows instantly, then `refreshTeams()` still flips a full-table skeleton over it — double feedback/flash |
| Deactivate/Reactivate dialog confirm | team-dialogs.tsx:361-374, 430-443 | inline-mutation | Same pattern, same double-feedback flash | already correct (#1) | spinner | Same skeleton-flash gap |
| UpsellDialog "Upgrade" link | team-dialogs.tsx:508-512 | route-nav | Plain `<Link>`, standard nav | either | n/a | — |
| TeamDetailDrawer "Add member" select | team-detail-drawer.tsx:94-114 | inline-mutation | `busyId` disables Select but shows no spinner; `router.refresh()` after has zero feedback | #1 partial | spinner recommended | Gap: refresh has no visual cue |
| TeamDetailDrawer "Remove from team" | team-detail-drawer.tsx:116-128, 274-285 | inline-mutation | Per-row spinner + disabled — good; `router.refresh()` after still unindicated | correct for button | spinner (already implemented) | Refresh-after gap |
| TeamDetailDrawer Lead toggle switch | team-detail-drawer.tsx:130-144, 264-271 | inline-mutation | `disabled={busy}`, no spinner slot on Switch itself | #1 | visual pending indicator missing | Looks identical to "already lead" disabled state |
| TeamDetailDrawer "Revoke invite" | team-detail-drawer.tsx:146-158, 369-382 | inline-mutation | Spinner + disabled — good | already correct | spinner (already implemented) | — |
| InviteForm submit | invite-form.tsx:96-140 | modal-step-advance | `pending` spinner+disabled; calls `router.refresh()` directly (not via `onDone`/skeleton like sibling dialogs) | already correct | spinner (already implemented) | Inconsistent tail-end vs. other team dialogs |

## 5. Dashboard

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| `DashboardDateFilter` Apply/Clear | dashboard-date-filter.tsx:190-207 | route-nav | Plain `router.push`, **not** wrapped in `useTransition` at all — zero pending state | #2 | skeleton (none exists today) | Most conspicuous silent full wait in the whole audit |
| `DashboardTabs` (Bookings/Portfolio) | dashboard-tabs.tsx:23-41 | route-nav | Plain `router.push`, toggle flips instantly but content is a different server subtree that lags with zero feedback | #2 | skeleton | Same class of gap |
| Mini booking calendar prev/next/jump/team-select | mini-booking-calendar.tsx:128-171 | inline-mutation (client fetch) | `opacity-60` dim while loading — but buttons stay clickable (no double-click guard) | already partially done | dim (already implemented) + add disabled | Minor polish only |
| Mini calendar day cell → Link to bookings | mini-booking-calendar.tsx:216-223 | route-nav | Plain `<Link>`, standard nav | either | n/a | — |
| Todays/Upcoming/RecentInquiries list → detail link; QuickAdd links; Portfolio dashboard links | various | route-nav | Plain `<Link>`, standard nav | either | n/a | — |

## 6. Notifications

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| Notification item click (mark read + navigate) | NotificationsListPage.tsx:53-65, 123-165 | inline-mutation | Optimistic instant flip, rollback on error; nav not gated on the mark-read promise | already correct | none needed | Pattern C-like |
| "Mark all read" | NotificationsListPage.tsx:67-72, 101-105 | inline-mutation | Optimistic instant flip, full rollback on failure; **no disabled state** during the call | #1 recommended | none currently | Gap: double-click fires twice (idempotent server-side, but wasteful) |
| "Load more" | NotificationsListPage.tsx:74-86, 195-206 | inline-mutation | `isPending` drives disabled + 3-row Skeleton | already correct | skeleton (already implemented) | Good pattern |
| "Retry" (load-more error) | NotificationsListPage.tsx:186-192 | inline-mutation | No dedicated disabled/loading state on this button | #1 | spinner/disabled recommended | Minor gap |
| Live socket arrival | NotificationsListPage.tsx:50-51, 95-99 | real-time push | Already wired — the one surface in the whole audit with a working live-update path | n/a | n/a | Reference example for the real-time work in phase 2 |

## 7. Onboarding (route-based wizard, not modal steps)

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| Business/Workspace/Plan "Continue" | business-form.tsx:55-67,149-163; workspace-form.tsx:82-94,193-207; plan-form.tsx:70-130,289-300 | route-nav (Action → push) | Spinner+text-swap+disabled already correct on every one of these buttons | already correct | spinner (already implemented) | — |
| Back links, progress-bar step links, in-page selectors (type pills, cadence toggle, plan card) | step-shell.tsx; business-form.tsx:120-141; plan-form.tsx:172-269 | route-nav / local state | Plain `<Link>` (back/jump) or instant local state (selectors) | either | n/a | — |
| Done step "Go to dashboard" | done-form.tsx:35-40,56-72 | route-nav (Action, server redirects) | `pending` spinner+text+disabled — but destination dashboard has **no skeleton** for its several parallel queries | already correct on button | skeleton on destination recommended | Heaviest destination in the app after the button spinner ends |
| Guide "don't show again" dismiss (portfolio, referenced from onboarding flow) | — | inline-mutation | Fire-and-forget, no loading state, 2 of 3 call sites don't even catch errors | n/a | n/a | Silent best-effort persistence, invisible failure |

## 8. Settings

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| Tab nav (route change under `[[...catchall]]`) | settings-user-profile.tsx:82-100,110-128 | tab-switch (route-nav) | Plain `<Link>`, no pending/active affordance; **every** tab re-fetches `requireOrg`+`getAuthUser`+`User.findOne`+`Workspace.find`+`getProPricing`+all 6 panels' props regardless of target tab | #1 (scoped tab pending) + #2 (panel skeleton) | both | Biggest "tab switch feels like a full reload" spot in the app — heavier than it looks |
| Workspace switcher dropdown item | settings-org-switcher.tsx:38-43,59-63 | inline-mutation | `useTransition`, spinner replaces chevron, disabled | already correct (#1) | spinner | Good pattern |
| Avatar upload/remove, Save display name, password change, MFA setup/verify/disable, "send set-password email" | account/_panel.tsx, _password-section.tsx, _mfa-section.tsx | inline-mutation | Spinner+disabled already wired throughout | already correct | spinner (already implemented) | — |
| Language select | customize/_panel.tsx:39-42,107-123 | route-nav | `router.replace(pathname,{locale})` — full locale route swap, **no pending state on the button** | #2 | skeleton | Gap |
| Time-format toggle | customize/_panel.tsx:44-55,134-155 | inline-mutation | Optimistic set + Action, but `useTransition`'s pending value is discarded (`const [, startTransition]`) — zero busy state | #1 | spinner | Gap: silent rollback possible with no in-flight cue |
| Billing "Upgrade to X" | billing/_panel.tsx:83-125,236-250 | inline-mutation | `loadingPlan` drives spinner on the specific plan button | already correct | spinner | Paddle overlay itself is 3rd-party |
| Dev-plan "Switch" | dev-plan/_panel.tsx:26-45,80-87 | inline-mutation | Per-row spinner, `window.location.reload()` on success | already correct | spinner | Pattern D-ish + reload |
| Public-page Save/Publish/Unpublish, icon/OG upload | public-page/_form.tsx | inline-mutation | `useOptimistic` for publish toggle (Pattern C), spinners elsewhere — already correct throughout | already correct | spinner (already implemented) | — |
| Workspace "Save" (business form) + logo upload | workspace/_business-form.tsx | inline-mutation | Spinner+disabled, slug field backed by existing `useSlugAvailability`/`SlugStatusIndicator` | already correct | spinner (already implemented) | — |

## 9. Portfolio editor

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| "Save changes" toolbar | EditorShell.tsx:790-858,1608-1618 | inline-mutation | `loading={savingChanges}` | already correct | spinner | — |
| "Publish" toolbar → PublishDialog | EditorShell.tsx:1094-1102,1745-1771 | dialog-open | Guarded via `UnsavedChangesDialog` if dirty; otherwise instant open | either | — | — |
| PublishDialog "Confirm" / slug save | PublishDialog.tsx:93-123,190-269 | inline-mutation | `publishing`/`slugSaveState` drive `loading` | already correct | spinner | Slug backed by existing availability-check pattern |
| "Theme" → ThemePanelDialog open | EditorShell.tsx:1104-1107,1568-1572 | dialog-open | Instant, no fetch (`savedThemes` already in memory) | either | — | — |
| ThemePanelDialog "Apply" | ThemePanelDialog.tsx:85-91,141-143 | inline-mutation | **No** `loading`/`disabled` while the save action is in flight | #1 | spinner | Gap: repeat-click possible |
| ThemePanelDialog delete saved theme | ThemePanelDialog.tsx:93-101 | inline-mutation | Optimistic array-filter, rollback+toast on error (Pattern A) | #1 | spinner | — |
| "Guide" → SpotlightGuide/SandboxEditorGuide | EditorShell.tsx:1573-1581,1939-1960 | dialog-open | All step-advances are pure client state, confirmed no fetch/Action anywhere | n/a | n/a | — |
| "Drafts" → DraftsDialog open | EditorShell.tsx:1587-1591,1963-1973 | dialog-open | Instant, already-loaded `drafts` state | either | — | — |
| DraftsDialog "Apply" (clean canvas) | EditorShell.tsx:872-924,1968; DraftsDialog.tsx:126-136 | dialog-open (sub-action) | `await getDraftAction(id)` with **zero** loading indicator — the common path | #1 | spinner | Real gap: most-used path is silent |
| DraftsDialog "Apply" (dirty canvas) | EditorShell.tsx:864-870,952-991 | modal-step-advance | Button spinner (`discarding`) **and** a full-canvas overlay (`role="status"`+`Loader2`) | #2 | spinner (already implemented) | Good dual-layer example |
| DraftsDialog "Delete" | EditorShell.tsx:994-1024; DraftsDialog.tsx:137-159 | inline-mutation | Per-row spinner, all controls disabled while deleting | already correct | spinner | — |
| TemplatePickerDialog "Use" | EditorShell.tsx:1180-1231; TemplatePickerDialog.tsx:149-171 | modal-step-advance | `switching` drives spinner+disabled, cards disabled | already correct | spinner | — |
| Header logo upload | HeaderPanelDialog.tsx:202-236,374 | inline-mutation | Label swap + disable | already correct | spinner | — |
| Preview toggle ("Show preview") | EditorShell.tsx:1049-1072,1524-1536 | inline-mutation (drives iframe route-nav) | `previewLoading` clears as soon as local state updates, **before** the iframe SSR route actually finishes | #2 | skeleton over iframe | Gap: possible blank/white flash after button spinner already stopped |
| Preview iframe reload (zone switch, theme/header save while previewing) | EditorShell.tsx:1088,1111,1127,1148,1172,1841-1846 | route-nav (`previewNonce` remount) | No overlay over the iframe region — old frame vanishes, new one loads bare | #2 | skeleton | Same class of gap, several trigger points |
| UnsavedChangesDialog Save/Discard | EditorShell.tsx:1995-2003; UnsavedChangesDialog.tsx:75-91 | inline-mutation / modal-step-advance | Both already correct (button spinner; Discard also gets the canvas overlay) | already correct | spinner | — |
| StoryPromptDialog step nav (0→3) | StoryPromptDialog.tsx:417,459,550,663 | modal-step-advance | Pure client state, not a round trip | n/a | n/a | — |
| StoryPromptDialog exit CTAs / logo-icon upload | StoryPromptDialog.tsx:302-391,420-430,675-691 | modal-step-advance / inline-mutation | `savingAction`/upload-state already drive spinner/label-swap | already correct | spinner | — |
| Guide "don't show again" dismiss | EditorShell.tsx:1284,1299,1927 | inline-mutation | Fire-and-forget, no loading state; 2 of 3 call sites don't catch errors | n/a | n/a | Silent best-effort, invisible failure |

## 10. Public portfolio pages (`/w/[orgSlug]`)

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| Header "Home"/"Gallery" nav links | PortfolioHeader.tsx:240-261,306-331 | route-nav | Plain `<Link>`, no pending affordance; targets have no `loading.tsx` | either | skeleton (layout/grid shape known) | `isActive` style only applies post-commit |
| Header "Contact" button | PortfolioHeader.tsx:262,332-338 | dialog-open | No server round trip — instant client modal | n/a | n/a | — |
| Featured-collection tile → CollectionPopup fetch | FeaturedCollectionsClient.tsx:82-116; CollectionPopup.tsx:159-231 | dialog-open | Already scoped spinner while `status:"loading"` | already correct | spinner | Reuse this exact pattern elsewhere |
| CollectionPopup "Load more" / Retry (×2) | CollectionPopup.tsx:340-538 | inline-mutation | Already scoped spinner rows | already correct | spinner | — |
| Contact form final submit | ContactForm.tsx:270-286,624-633 | form-submit | Text-only swap (`isSubmitting`), no spinner icon; hand-styled button, not the shared `Button` | already #1 (text-only) | add spinner via shared `Button` | Weaker than the rest of the app |

## 11. Auth + invite

| Trigger | File:Line | Type | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|---|
| Sign-in/Sign-up (+ Google variants), Forgot/Reset-password, Verify-email, MFA code submit | `(auth)/*/_*-form.tsx`, `_actions.ts` | form-submit | Shared `Button loading` already covers the whole wait, including the post-`redirect()` window | already correct | spinner (already implemented) | Destination has no `loading.tsx`, but the button spinner already bridges it |
| Verify-email "Resend" | verify-email/_verify-email-form.tsx:77-87 | inline-mutation | Plain `<button>`, text-only swap, no spinner icon | already #1 (text-only) | add spinner via shared `Button` | Same weaker-pattern issue as public contact form |
| Invite-accept CTA ("Sign in"/"Go to dashboard") | invite/accept/page.tsx:88-101 | route-nav | Raw `<a href>` — hard reload, no in-app feedback | #2 | rely on browser progress bar, or convert to `Link`+skeleton | Inconsistent with rest of app's `Link` usage — flag, don't silently rework |
| Invite-accept redirect chain (email link → SSR redirect → route handler → redirect) | invite/accept/page.tsx:51-60 | route-nav | Two server hops, zero visual feedback, no client trigger to scope a button to | #2, blocked | needs an interstitial `loading.tsx` on `/invite/accept`, or a flow change | Flagging per the prompt's own carve-out (Route Handlers can't have `loading.tsx`); a real fix changes the flow, not just UI |

## 12. App-sidebar nav vs. the 25 routes

| Trigger | File:Line | Current loading behavior | Classification | Skeleton/spinner | Notes |
|---|---|---|---|---|---|
| Dashboard link | app-sidebar.tsx:197-212 → dashboard/page.tsx | No `loading.tsx`; `Promise.all` + separate parallel query modules | #2 (strongest case) | skeleton | Heaviest route in the app |
| Bookings link | → bookings/page.tsx | No `loading.tsx`; 7 DB/query calls | #2 | skeleton | 2nd heaviest |
| Inquiries link | → inquiries/page.tsx | No `loading.tsx`; 6 sequential calls | #2 | skeleton | — |
| Clients link | → clients/page.tsx | No `loading.tsx`; 5 calls | either | skeleton | Moderate |
| Portfolio link | → portfolio/page.tsx | No `loading.tsx`; 3 calls | either | spinner acceptable | Lighter |
| Teams link | → teams/page.tsx | No `loading.tsx`; 4 calls | either | spinner acceptable | Lighter |
| Settings links (footer + logo) | app-sidebar.tsx:127-137,228-236 → settings/[[...catchall]]/page.tsx | No `loading.tsx`; **all 6 panels' props built on every navigation** regardless of target tab | #2 | skeleton | Surprise finding — heavier than it looks; see §8 |
| Sign out | app-sidebar.tsx:237-247 → SignOutConfirmDialog | `useTransition`+spinner+disabled already wired | already correct | spinner (already implemented) | Good pattern |
| Theme toggle | theme-toggle.tsx | Pure client state (`next-themes`), confirmed no server round trip | n/a | n/a | Correctly out of scope |
| Locale switcher | locale-switcher.tsx:59 | `router.replace(href,{locale})` — **is** a server round trip (re-renders current page in new locale); no pending indicator | #1 (item-scoped) | spinner on clicked menu item | Easy to mistake for client-only; it isn't |

---

## Real-time update gaps (§1 of the interactivity requirements)

- **Bookings/Inquiries**: activity feeds and calendars never live-update when another user mutates the same record — resync only via this browser's own refresh/nav, never a push.
- **Bookings/Inquiries**: no "someone else is viewing/editing" indicator for concurrent edits; last optimistic save silently wins.
- **Teams**: member add/remove/lead-toggle/invite-revoke rely solely on `router.refresh()`; a concurrent change from another owner/tab needs a manual reload to appear.
- **Dashboard**: no widget is live; Activity Feed in particular reads as though it should reflect new bookings/inquiries in near-real-time but only refreshes on full reload/date-filter/tab change.
- **Cross-cutting**: a new inquiry submitted through the public `ContactForm` triggers a live notification (bell already updates via socket.io) but the underlying `/inquiries` list and dashboard metrics are SSR-per-navigation only — the notification arrives live, the data behind it doesn't.
- **Settings/Portfolio**: no live-sync surface at all; two owners/tabs editing the same workspace (theme, drafts, plan) can silently overwrite each other with no conflict indicator.
- **Notifications** is the one surface already wired for live updates (`NotificationProvider`/`useNotifications`) — use it as the reference implementation when adding sockets elsewhere.

## Optimistic-UI gaps (§2 of the interactivity requirements)

- `InquiryActions` decline/archive don't optimistically patch the row (falls back to hard `router.refresh()`), unlike sibling phone/draft-field edits on the same page.
- `BookingDraftCard` sessions-editor conflict-check has no in-flight indicator and no request-id race guard, unlike the wizard's `reqIdRef`.
- Booking detail modal's session remove/date-shift and cancel/restore share one `saving` boolean with the unrelated global "Save changes" button instead of per-action state.
- Clients: `ClientDetailModal` footer "Reactivate" doesn't reflect the same pending state the table row does.
- Clients: `ClientFormModal` submit is text-only, not the spinner-icon pattern used everywhere else.
- Teams: Create/Edit/Deactivate/Reactivate dialogs apply an optimistic update immediately, then still flip a full-table skeleton via `refreshTeams()` — a visible "flash" over data that's already correct.
- Teams: `InviteForm` calls `router.refresh()` directly instead of routing through the same `onDone`/skeleton path the other team dialogs use.
- Notifications: "Mark all read" and "Retry" have no disabled/pending guard against double-clicks, unlike "Load more".
- Dashboard: `DashboardDateFilter` and `DashboardTabs` trigger full-page RSC re-fetches with zero pending indication anywhere — the most conspicuous silent wait in the audit.
- Settings: tab-nav and the Customize language switch have no in-flight indicator; the time-format toggle discards its own `useTransition` pending flag.
- Portfolio: `ThemePanelDialog` "Apply" has no busy state; `DraftsDialog` "Apply" has none on its common (clean-canvas) path; preview-iframe reloads show nothing during the actual network fetch.

## Micro-interaction / polish notes (§3 of the interactivity requirements)

- Bookings table: desktop `<tr>` row click lacks `role="button"`/`tabIndex`/`onKeyDown` — keyboard users can't activate it (mobile cards already have this). Not hover-only, but a keyboard-access gap in the same family of "control must work without a mouse."
- Teams: lead-toggle `Switch` while pending looks identical to the "already lead" disabled state — no distinct in-flight visual.
- Invite-accept CTA uses a raw `<a href>` instead of the app's `Link`, forcing a hard reload inconsistent with the rest of the app.
- Portfolio guide "don't show again" dismiss fails silently in 2 of 3 call sites (no `.catch`) — not a loading-state issue, but a silent-failure gap worth fixing alongside this work.

## Reusable pieces to lean on in phase 2

- `components/ui/button.tsx` `Button`'s `loading` prop — already the dominant pattern; extend its use to the few text-only/no-icon holdouts (client form modal, verify-email resend, public contact form) instead of inventing a new spinner treatment.
- `hooks/use-guarded-action.ts` — already used for reactivate/CSV-import/deactivate; reuse for any new action needing loading+concurrency-guard (e.g. "Mark all read", ThemePanelDialog "Apply", DraftsDialog "Apply").
- `components/app/table-skeleton.tsx` — already used correctly on Inquiries/Bookings pagination and Clients filters; the pattern to copy for Settings tab-switch and Dashboard filter/tab changes.
- Optimistic patterns A–D (`optimistic-rendering` skill) — reuse the closest existing variant per mutation type; don't invent a 5th.
- `NotificationProvider`/`useNotifications` (socket.io) — the only working real-time reference; model any new live-update surface (team membership, inquiry list, dashboard counts) on this transport and the actor-silent convention from the `notifications` skill.

---

**Next step**: review and prioritize the items above before any implementation begins, per the task's phase gate.
