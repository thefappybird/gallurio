# Reusable Code Catalog

Shared, reusable building blocks in Gallurio — components, hooks, and helpers —
plus a ranked list of duplication / extraction candidates.

**Read this before writing any component, hook, or helper.** If something here
covers your need, import and reuse it; do not write a parallel copy. When you
create new genuinely-shared code, add it here in the same change. When you spot
duplication you are not extracting now, log it under **Extraction candidates**.
See `CLAUDE.md` → **DRY & code reuse (cross-agent)** for the full policy.

> Token note: this catalog exists so agents discover existing code cheaply
> instead of re-reading source. Prefer it, then the codebase-memory graph
> (`search_code` / `SIMILAR_TO`), then file reads — in that order.

Last audited: 2026-06-17 (branch `dev`).

---

## 1. UI primitives — `components/ui/`

Base-UI / shadcn-style primitives. Tailwind v4 + CVA variants, `data-slot`
hooks, ARIA built in. Controls use `--radius` (default subtle/0.25rem); structural
frames use `--radius-surface` (default sharp/0rem) — see Design rules in `CLAUDE.md`.

| Import | Exports | Purpose | Key props / variants |
|--------|---------|---------|----------------------|
| `components/ui/button.tsx` | `Button` | Action button with loading state | `variant`: default/brand/outline/secondary/ghost/destructive/link; `size`: xs/sm/default/lg/icon*; `loading` |
| `components/ui/input.tsx` | `Input` | Text input | HTML input props; `aria-invalid` error state |
| `components/ui/label.tsx` | `Label` | Form label | peer-disabled aware |
| `components/ui/textarea.tsx` | `Textarea` | Multi-line input | `min-h-20` default |
| `components/ui/select.tsx` | `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` | Dropdown select (generic) | `Select<Value = string>` |
| `components/ui/switch.tsx` | `Switch` | Toggle | checked/unchecked data states |
| `components/ui/card.tsx` | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardAction`, `CardContent`, `CardFooter` | Container w/ slots | `size`: default/sm |
| `components/ui/badge.tsx` | `Badge` | Status/tag chip | `variant`: default/secondary/destructive/outline/ghost/link |
| `components/ui/separator.tsx` | `Separator` | Divider | `orientation`: horizontal/vertical |
| `components/ui/avatar.tsx` | `Avatar`, `AvatarImage`, `AvatarFallback`, `AvatarBadge`, `AvatarGroup`, `AvatarGroupCount` | Avatar w/ fallback, badge, group | `size`: default/sm/lg |
| `components/ui/dropdown-menu.tsx` | `DropdownMenu*` (Trigger/Content/Group/Label/Item/CheckboxItem/RadioGroup/RadioItem/Sub*/Separator/Shortcut) | Context menu | item `variant`: default/destructive; `inset` |
| `components/ui/dialog.tsx` | `Dialog*` (Trigger/Portal/Content/Header/Footer/Title/Description/Close/Overlay) | Modal dialog | `showCloseButton` |
| `components/ui/sheet.tsx` | `Sheet*` (Trigger/Content/Header/Footer/Title/Description/Close/Portal/Overlay) | Side drawer | `side`: top/right/bottom/left |
| `components/ui/alert-dialog.tsx` | `AlertDialog*` (Content/Header/Title/Description/Footer/Action/Cancel) | Confirmation dialog on Dialog primitives | alert icon header; destructive action + outline cancel |
| `components/ui/popover.tsx` | `Popover`, `PopoverTrigger`, `PopoverContent` | Floating content | `side`/`align`/`sideOffset` |
| `components/ui/tooltip.tsx` | `Tooltip`, `TooltipTrigger`, `TooltipContent`, `TooltipProvider` | Hover tooltip | `side`/`align`; `delay` |
| `components/ui/tabs.tsx` | `Tabs`, `TabsList`, `TabsTab`, `TabsPanel` | Tab navigation | border-bottom active indicator |
| `components/ui/skeleton.tsx` | `Skeleton` | Loading placeholder | pulse animation |
| `components/ui/sonner.tsx` | `Toaster` | Toast container | themed via next-themes; bottom-right; 4s |
| `components/ui/sidebar.tsx` | `Sidebar*` system + `useSidebar` | Full sidebar layout (collapse, mobile sheet, cookie persist, Ctrl+B) | `variant`: sidebar/floating/inset; `collapsible`: offcanvas/icon/none; `side` |
| `components/ui/phone-input.tsx` | `PhoneInput` | Intl phone input | defaults to PH; react-phone-number-input |
| `components/ui/color-picker.tsx` | `ColorPicker` | Hex picker w/ presets | `value`, `onChange(hex)`, `presets`, `disabled` |
| `components/ui/location-picker.tsx` | `LocationPicker`, `BaseLocationPicker`, `IntlLocationPicker`, `LocationDisplay`, `LocationReadOnly` | Location select (Nominatim geocode + drag pin). **Commit-only semantics**: `onChange` fires only on explicit Accept (✓); Discard (✗) reverts to last committed value — never fires on intermediate map/search state. Accepts `ariaDescribedby` to associate error messages with the inner search input. `LocationReadOnly` is unused (see extraction candidates). | `value: {address,lat,lng}`; `editable`/`compact`/`searchEnabled`/`ariaDescribedby`; i18n |
| `components/ui/location-map.tsx` | `LocationMap` (default) | Leaflet map w/ draggable pin | `lat`/`lng` nullable; `onPick`; `compact`/`scrollWheelZoom` |

## 2. App components — `components/app/`

Composed, app-specific shared components.

| Import | Exports | Purpose | Key props |
|--------|---------|---------|-----------|
| `components/app/app-sidebar.tsx` | `AppSidebar` | Full app sidebar: branding, role-based nav, theme toggle, user menu, sign-out | `role`, `workspaceName`, `workspaceLogoUrl`, `userName`, `userEmail`, `userAvatarUrl` |
| `components/app/theme-provider.tsx` | `ThemeProvider` | next-themes provider wrapper | class attribute, system default |
| `components/app/theme-toggle.tsx` | `ThemeToggle` | Theme switcher dropdown | hydration-safe |
| `components/app/table-skeleton.tsx` | `TableSkeleton` | Table loading skeleton w/ realistic column widths | `columns`, `rows?` (8) |
| `components/app/page-size-select.tsx` | `PageSizeSelect` | Rows-per-page dropdown; syncs URL param, resets page | `value`, `paramName` ("limit"), `options` |
| `components/app/clear-filters-button.tsx` | `ClearFiltersButton` | Clears filter params from URL; hidden when none active | `paramKeys`, `defaultValues?` |
| `components/app/sign-out-confirm.tsx` | `SignOutConfirmDialog` | Controlled logout confirm dialog | `open`, `onOpenChange` |
| `components/app/sign-out-link.tsx` | `SignOutLink` | Sign-out button form wrapper | children |

## 3. Hooks

| Import | Export | Signature | Purpose |
|--------|--------|-----------|---------|
| `hooks/use-mobile.ts` | `useIsMobile` | `() => boolean` | Mobile viewport (<768px) via media-query listener |
| `hooks/use-guarded-action.ts` | `useGuardedAction` | `(action, { onError? }) => { loading, trigger }` | Wrap async action: loading state, blocks concurrent invocations |
| `lib/hooks/useGlobalContactTrigger.ts` | `useGlobalContactTrigger` | `(open: () => void) => void` | Register global contact-modal opener; cleans up on unmount |
| `lib/page-builder/brandKitContext.tsx` | `useBrandKit` | `() => PortfolioBrandKit` | Read current workspace brand kit (throws outside provider) |

## 4. Helpers / utilities

### `lib/utils.ts` & `lib/utils/`
| Import | Export | Signature | Purpose |
|--------|--------|-----------|---------|
| `lib/utils.ts` | `cn` | `(...ClassValue[]) => string` | Merge Tailwind classes (clsx + twMerge) |
| `lib/utils/format-currency.ts` | `formatMoney` | `(amount, currency, locale) => string` | Localized currency via Intl.NumberFormat |
| `lib/utils/csv-parse.ts` | `parseCsv` | `(text) => { headers, rows }` | RFC-4180 CSV parser (quotes, CRLF/LF) |
| `lib/utils/csv-parse.ts` | `normalizeCsvHeader` | `(raw) => string` | Map raw header → camelCase |
| `lib/utils/csv-serialize.ts` | `serializeCsv`, `serializeRow`, `quoteField` | rows/headers → CSV | RFC-4180 serialize (CRLF) |
| `lib/utils/handleActionResult.ts` | `toastActionResult` | `(result, successMessage) => result is {ok:true}` | Toast error/success + type-guard for server-action results |
| `lib/utils/timezone.ts` | `wallTimeInTzToUtc` | `(date, time, tz) => ISO` | Wall-clock in IANA tz → UTC ISO |
| `lib/utils/timezone.ts` | `dayBoundInTz` | `(dateStr, tz, h, min, sec, ms) => Date` | DST-aware day-bound UTC Date |
| `lib/utils/timezones.ts` | `formatUtcOffset`, `TIMEZONE_GROUPS` | — | Offset formatting; grouped tz options |
| `lib/utils/time-format.ts` | `formatTime`, `formatTimeRange`, `formatRangeFromParts`, `DEFAULT_TIME_MODE`, `TIME_INPUT_LANG` | — | Display Date/time range as 24h/12h; `formatRangeFromParts(startHHMM, endHHMM, mode)` is the shared primitive both `formatTimeRange` and `formatSessionTimeRange` delegate to — use it when you already have wall-clock HH:MM strings |
| `lib/utils/get-user-time-format.ts` | `getUserTimeFormat` | `() => Promise<TimeMode>` | Read user time-format pref from cookie (fallback 24h) |
| `lib/pagination.ts` | `PAGE_SIZE_OPTIONS` | `[10,20,30,50]` | Shared page sizes (client + server) |

### `lib/bookings/`
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/bookings/candle-split.ts` | `splitSessionIntoCandles` | Split multi-day session into per-day candles; overnight + past-day handling |
| `lib/bookings/session-edits.ts` | `startOfDay`, `endOfDay`, `countDays`, `countPastDays`, `splitDayOut`, `shiftSession`, `shiftSessionTimes` | Session date math + edit operations (past/future split) |
| `lib/bookings/session-validation.ts` | `sessionsAreSameDayInTz` | Verify session start/end same calendar day in workspace tz |
| `lib/bookings/status-style.ts` | `STATUS_COLOR_VAR`, `STATUS_ORDER`, `CONFLICT_COLOR_VAR` | Canonical booking-status CSS var map + status ordering; `CONFLICT_COLOR_VAR = "var(--danger)"` is the conflict candle color token (mirrors `--danger` in `app/globals.css`) — used by table pills, calendar candles, and legend |

### `lib/inquiries/`
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/inquiries/session-time.ts` | `formatSessionTimeRange(session, mode, _tz)` | Format inquiry session times (`{ startTime, endTime }` HH:MM wall-clock strings) as a display range; delegates to `formatRangeFromParts` — structurally guaranteed to match `formatTimeRange` output for the same wall-clock time (fixes calendar↔modal mismatch #14). Pass workspace tz for documentation clarity but it is intentionally unused. |
| `lib/inquiries/optimistic-patch.ts` | `applyOptimisticPatch<T extends {id:string}>(rows, patches)`, `InquiryOptimisticPatch` | Overlay a `Record<id, patch>` map over table rows for instant optimistic UI; reconciles automatically on server re-render. |
| `app/[locale]/(app)/inquiries/_actions.ts` | `rescheduleInquirySessionAction(input)` | Server action: reschedule a single inquiry session (owner-auth, Zod-validated, idempotent, conflict-checked via `sessionConflictsWithBookings`). |

### `lib/auth/` (see also CLAUDE.md → Auth & tenancy)
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/auth/session.ts` | `getAuthUser` | **Single** authoritative identity reader (wraps `withAuth`) — never call `withAuth` elsewhere |
| `lib/auth/activeWorkspace.ts` | `getActiveWorkspaceId`, `setActiveWorkspace`, `clearActiveWorkspace` | Resolve/set/clear active-workspace cookie (re-validated vs DB) |
| `lib/auth/requireOrg.ts` | `requireOrg`, `requireRole` | Page-level context guard (redirects); role hard-gate |
| `lib/auth/ownerContext.ts` | `ownerContext` | Server-action context guard (returns `{error}`) |
| `lib/auth/assertCanAddTeam.ts` | `assertCanAddTeam`, `createTeamWithCapEnforcement` | Team-cap preflight + atomic create |
| `lib/auth/assertCanAddTeamMember.ts` | `assertCanAddTeamMember`, `releaseTeamSeat` | Atomic seat reserve / rollback |
| `lib/auth/signOut.ts` | `signOutAction` | Clear session + active-ws cookie; redirect /sign-in |
| `lib/auth/canEditBooking.ts` | `canWriteBookingForTeam`, `canEditBooking` | Booking write/edit authorization |
| `lib/auth/bookingTeamScope.ts` | `resolveBookingTeamScope` | Booking read scope (owner=all, else teamIds) |
| `lib/auth/teamContext.ts` | `getTeamsForUser`, `isLeadOnTeam`, `isOnTeam` | Per-request cached team memberships + checks |
| `lib/auth/memberAccess.ts` | `stripLocale`, `isMemberBlocked`, `landingPathForRole` | Locale strip; member route gating; post-login landing |

### `lib/db/`
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/db/mongoose.ts` | `connectDB` | Lazy cached connection (pool 10, bufferCommands off) |
| `lib/db/clientTransactions.ts` | `recordBookingForClient`, `reassignBookingBetweenClients` | Atomic client financial-footprint writes |
| `lib/db/queries/inquiry-conflicts.ts` | `computeInquiryConflicts(workspaceId, inquiries, tz)`, `sessionConflictsWithBookings(workspaceId, tz, session, excludeBookingId?)` | Booking-only conflict detection for inquiries: bulk check across all inquiries (calendar list view) or single-session check (reschedule action); one Booking query per call |

### Other lib
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/plans/entitlements.ts` | `planEntitlements`, `PLAN_ENTITLEMENTS` | Plan-tier limits lookup |
| `lib/theme/themes.ts` | `resolveScheme`, `THEMES`, `SELECTABLE_THEME_IDS` | Theme defs + light/dark resolution |
| `lib/theme/appTheme.ts` | `AppRadius`, `AppThemeConfig`, `DEFAULT_APP_THEME`, `appThemeAttributes` | Typed app-shell theming seam: `AppRadius` = "sharp" \| "subtle" \| "rounded"; `appThemeAttributes(config)` returns `{ "data-radius": ... }` spread onto `<html>` in the layout; `DEFAULT_APP_THEME` = `{ radius: "subtle" }`. Extend here when adding accent/base/font presets — no component changes needed, only a new `globals.css` block + cookie resolver. |
| `app/globals.css` (`html[data-radius]` blocks) | CSS vars `--radius`, `--radius-surface` | Roundness seam: `html[data-radius="sharp"]` / `"subtle"` / `"rounded"` override the two radius tokens. Controls consume `--radius`; structural frames consume `--radius-surface`. Never set these inline — always go through the `data-radius` attribute driven by `appThemeAttributes`. |
| `lib/i18n/navigation.ts` | `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` | Locale-aware navigation (next-intl) |
| `lib/i18n/request.ts` | default | next-intl per-request config |
| `lib/server/rateLimit.ts` | `rateLimit`, `__resetRateLimitForTests` | In-memory sliding-window limiter (best-effort, NOT distributed) |
| `lib/teams/team-colors.ts` | `TEAM_COLOR_PALETTE`, `INACTIVE_TEAM_COLOR` | Client-safe team color presets |
| `lib/page-builder/brandKitContext.tsx` | `BrandKitProvider`, `useBrandKit` | Workspace brand-kit context |

---

## 5. Extraction candidates (duplication to consolidate)

Code that repeats across features and should become a single shared module.
Pick these up when touching the relevant feature; when you extract one, move its
entry up into the catalog above. Confidence = how certain the copies are truly
the same. (Sourced from the 2026-06-17 audit; verify current state before acting.)

### Components

| # | Candidate | Copies | What's duplicated | Suggested home | Confidence |
|---|-----------|--------|-------------------|----------------|------------|
| C-0 | `LocationReadOnly` export cleanup | `components/ui/location-picker.tsx` | `LocationReadOnly` is exported but no longer called (its only caller was replaced in Task 13 by the new commit-only `LocationPicker`). Safe to remove once confirmed no external callers remain. | Delete export or keep as deprecated alias | high |
| C-1 | View toggle (table/calendar) | `bookings/_components/view-toggle.tsx`, `inquiries/_components/inquiry-view-toggle.tsx` | ~95% identical; differ only by localStorage key + i18n namespace | `components/app/view-toggle.tsx` (params: `storageKey`, `namespace`) | high |
| C-2 | Confirm dialog template | `bookings/_components/{cancel-confirm,past-date-confirm,session-edit-confirm}-dialog.tsx`, `clients/_components/deactivate-client-dialog.tsx`, `teams/_components/downgrade-block-modal.tsx` | Same shell: alert-icon header + border-b, title/body, two-button footer (outline + destructive) | `components/app/confirm-dialog.tsx` (slots: icon, heading, body, actions) | high |
| C-3 | Unsaved-changes dialog | `bookings/_components/unsaved-changes-dialog.tsx`, `clients/_components/unsaved-changes-dialog.tsx`, `portfolio/_components/UnsavedChangesDialog.tsx` | Bookings & clients ~90% identical; portfolio variant differs (save/discard/cancel) | `components/app/unsaved-changes-dialog.tsx` | high |
| C-4 | Status / source badge | `inquiries/_components/inquiry-status-badge.tsx`, `clients/_components/source-badge.tsx` | Map value→color classes, translate label, render `Badge` w/ `cn()` | `components/app/status-badge.tsx` (params: status map, i18n key) | high |
| C-5 | Data toolbar | `bookings/_components/bookings-toolbar.tsx`, `clients/_components/clients-toolbar.tsx` | Search input + filter selects + toggles + `ClearFiltersButton` + URL-param sync + debounce (~85% shared layout) | `components/app/data-toolbar.tsx` (generic container, domain filters as children) | med-high |
| C-6 | Detail modal | `bookings/_components/booking-detail-modal.tsx`, `clients/_components/client-detail-modal.tsx` | Header+close, lazy tabbed content, optional footer actions; near-identical tab/loading mgmt | `components/app/detail-modal.tsx` (header/tabs/content/footer slots) | med |
| C-7 | Multi-step form wizard | `clients/_components/client-form-modal.tsx`, `bookings/_components/booking-wizard-modal.tsx` | Step nav + unsaved-changes guard + submit handling | `components/app/form-wizard.tsx` | med |
| C-8 | Import-results display | `bookings/_components/import-results-dialog.tsx` (inside `csv-import-dialog.tsx` flow) | Expandable error-row results table is generic though importer is domain-specific | `components/app/import-results-dialog.tsx` | med |
| C-9 | Activity timeline | `bookings/_components/activity-timeline.tsx` (+ `activity-types.ts`), wrapped by `booking-history-dialog.tsx` | Timeline (action styling, date grouping) is generic; dialog is just a paginated wrapper | `components/app/activity-timeline.tsx` | med-low |
| C-10 | Team multi-select | `bookings/_components/team-picker.tsx` (wraps `team-legend.tsx` in popover) | Shared multi-select logic; legend could stand alone | `components/app/team-multi-select.tsx` | med-low |

### Logic / helpers

Note several of these duplicate logic that a **shared helper already covers** —
prefer reusing the existing module over a new one where flagged.

| # | Candidate | Copies | What's duplicated | Suggested home | Confidence |
|---|-----------|--------|-------------------|----------------|------------|
| L-1 | Inline PHP currency formatter | `settings/billing/_panel.tsx`, `onboarding/plan/plan-form.tsx` | Local `formatPHP()` — but `lib/utils/format-currency.ts` `formatMoney` already exists | Reuse `formatMoney`, or add a `formatPHP` convenience there | high |
| L-2 | Inline `Intl.DateTimeFormat` date-time formatters | `bookings/_components/booking-detail-modal.tsx` (×4), `clients/_components/client-detail-modal.tsx`, `settings/billing/_panel.tsx`, `settings/public-page/_form.tsx` | Same weekday/month/day/year/hour/minute config repeated | New `lib/utils/format-date-time.ts` (locale-aware), or extend `time-format.ts` | high |
| L-3 | Clipboard-copy + "copied" toast/flag | `settings/public-page/_form.tsx`, `portfolio/_components/PublishDialog.tsx`, `settings/account/_mfa-section.tsx` | `clipboard.writeText` + `setCopied(true)` + 2s reset | New `lib/hooks/useClipboard.ts` | high |
| L-4 | `toLocaleDateString()` date display | 30+ call sites across bookings / dashboard / inquiries `_components` | Ad-hoc `new Date(v).toLocaleDateString(locale, {...})` | Extend `lib/utils/time-format.ts` (add date formatters) — partly overlaps L-2 | med |
| L-5 | Fetch JSON + error-unwrap pattern | `bookings/_components/booking-detail-modal.tsx` (×3), `settings/billing/_panel.tsx`, `onboarding/plan/plan-form.tsx` | `await res.json().catch(()=>({}))` then `if(!res.ok) throw data.error` | New `lib/utils/fetch-helpers.ts` `fetchJson()` | med |
| L-6 | Manual `useRef` debounce for search | `bookings/_components/booking-detail-modal.tsx` (ClientReassignPicker), `bookings/_components/bookings-toolbar.tsx`, `clients/_components/clients-toolbar.tsx` | `debounceRef` + `setTimeout`/`clearTimeout` in effect | New `lib/hooks/useDebounce.ts` (pairs with C-5 toolbar) | med |
| L-7 | Local `PAGE_SIZE` constants | `bookings/_components/booking-history-dialog.tsx` (5), `bookings/_components/team-filter-control.tsx` (12) | Per-component page sizes while `PAGE_SIZE_OPTIONS` is centralized | Either accept as context-specific or name them in `lib/pagination.ts` | low |

---

## Maintenance

- Keep entries accurate on move/rename/delete — a stale catalog wastes tokens.
- When extracting a candidate: build the shared module, repoint call sites, add
  tests, update all 4 locales, then move the entry from §5 into §1–§4.
- Recommended first extractions (quick, high-reuse, low-risk): C-1 view toggle,
  C-2 confirm dialog, C-4 status badge, C-3 unsaved-changes dialog, plus the
  logic quick wins L-1 (reuse `formatMoney`), L-3 clipboard hook, L-2 date-time
  formatter.
