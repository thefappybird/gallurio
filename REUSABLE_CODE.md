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

Last audited: 2026-07-13 (branch `action/beta-release-cleanup` — extracted `EmptyState`).

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
| `components/ui/collapsible-drawer.tsx` | `CollapsibleDrawer` | Reusable collapsible drawer with a keyboard-accessible header toggle, optional header actions, and a separate scrollable body region. Use for tall repeated stacks like booking sessions where each item should expand independently without nesting interactive controls inside a native `<summary>`. | `title`, `subtitle?`, `actions?`, `defaultOpen?`, controlled `open`/`onOpenChange`, `bodyClassName?` |
| `components/ui/color-picker.tsx` | `ColorPicker` | Hex picker w/ presets | `value`, `onChange(hex)`, `presets`, `disabled` |
| `components/ui/segmented-toggle.tsx` | `SegmentedToggle<K>`, `SegmentedToggleOption<K>` | Single-select pill toggle (tablist/tab ARIA). Outer container owns border + `rounded-lg` + `overflow-hidden`; buttons `rounded-none`; `divide-x divide-border` for inner dividers — no doubled borders. Active = `bg-brand text-brand-foreground`. Mobile: full-width `min-h-11`; sm+: `inline-flex w-auto h-9`. | `value: K`, `onChange(key: K)`, `options: {key, label, icon?}[]`, `ariaLabel: string`, `className?` |
| `components/ui/location-picker.tsx` | `LocationPicker`, `BaseLocationPicker`, `IntlLocationPicker`, `LocationDisplay`, `LocationReadOnly` | Location select (Nominatim geocode + drag pin). **Commit-only semantics**: `onChange` fires only on explicit Accept (✓); Discard (✗) reverts to last committed value — never fires on intermediate map/search state. Accepts `ariaDescribedby` to associate error messages with the inner search input. `LocationReadOnly` is unused (see extraction candidates). | `value: {address,lat,lng}`; `editable`/`compact`/`searchEnabled`/`ariaDescribedby`; i18n |
| `components/ui/location-map.tsx` | `LocationMap` (default) | Leaflet map w/ draggable pin | `lat`/`lng` nullable; `onPick`; `compact`/`scrollWheelZoom` |
| `components/ui/timezone-combobox.tsx` | `TimezoneCombobox` | Searchable IANA-timezone picker (Popover + filtered listbox) replacing the native grouped `<select>`. Search matches IANA name/city AND UTC offset (`"+8"`, `"8"`, `"utc+8"` all hit); region group headers; ↑/↓/Enter/Esc keyboard nav; `combobox`/`listbox`/`option` ARIA + `aria-activedescendant`. Options come from `TIMEZONE_GROUPS` (`lib/utils/timezones`). RHF-friendly via `Controller`. Copy is passed in (not self-translated). Predates and is NOT yet migrated onto `Combobox` below (extraction candidate — behavior parity would need to be verified against its own test suite first). | `value: string` (IANA), `onChange(value)`, `searchPlaceholder`, `noMatchesLabel`, `id?`, `name?`, `placeholder?`, `disabled?` |
| `components/ui/combobox.tsx` | `Combobox<T>`, `ComboboxGroup<T>`, `ComboboxTrailingAction` | Generic searchable popover combobox: Popover + search `Input` + scrollable grouped `listbox` (`max-h-64 overflow-y-auto`, contained in a portal — fixes native `<select>`/`<optgroup>` popups escaping the viewport). Full keyboard nav (↑/↓/Enter/Esc), `aria-activedescendant`, checkmark on the selected option, per-item inline `style` (e.g. font-family preview), optional non-list trailing action row (e.g. "Custom…") that calls its own `onSelect` instead of `onChange`. Caller supplies `getValue`/`getLabel`/(`getItemStyle`?)/(`filterItem`?) so it's data-shape-agnostic; used by `FontSelector` (`lib/page-builder/brandKitPicker/BrandKitPicker.tsx`) for the Theme panel's heading/body font pickers. Copy passed in (not self-translated). | `groups: ComboboxGroup<T>[]`, `getValue`, `getLabel`, `value`, `onChange(value)`, `selectedLabel`, `searchPlaceholder`, `noMatchesLabel`, `getItemStyle?`, `filterItem?`, `trailingAction?`, `id?`, `ariaLabel?`, `disabled?` |
| `components/ui/turnstile-widget.tsx` | `TurnstileWidget`, `TurnstileWidgetHandle` | Cloudflare Turnstile bot-check widget (explicit render, no npm dep). Dev bypass fires a `"dev-bypass"` sentinel token when `NODE_ENV==="development"`; renders nothing when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is unset. Server-verify the token with `verifyTurnstileToken` (`lib/server/turnstile.ts`). Used by the (auth) sign-in/sign-up/forgot-password forms and the public inquiry form. | `ref` exposing `reset()` (call after any failed submit — tokens are single-use); `onToken`, `onExpire?`, `onError?`, `className?` |

## 2. App components — `components/app/`

Composed, app-specific shared components.

| Import | Exports | Purpose | Key props |
|--------|---------|---------|-----------|
| `components/app/app-sidebar.tsx` | `AppSidebar` | Full app sidebar: branding, role-based nav, theme toggle, locale switcher, user menu, sign-out | `role`, `workspaceName`, `workspaceLogoUrl`, `userName`, `userEmail`, `userAvatarUrl` |
| `components/app/theme-provider.tsx` | `ThemeProvider` | next-themes provider wrapper | class attribute, system default |
| `components/app/theme-toggle.tsx` | `ThemeToggle` | Theme switcher dropdown | hydration-safe |
| `components/app/ambient-background.tsx` | `AmbientBackground` | Full-bleed, theme-aware, slowly-drifting SVG background (swaps light/dark SVG via `dark:` classes); fills its nearest `relative` ancestor | none — position/size via a `relative overflow-hidden` wrapper |
| `components/app/locale-switcher.tsx` | `LocaleSwitcher` | Locale switcher dropdown (sidebar footer); reuses catalog native names, swaps locale via next-intl navigation keeping the path | none |
| `components/app/table-skeleton.tsx` | `TableSkeleton` | Viewport-filling table loading skeleton with realistic column widths; measures remaining page height, reserves following pagination, and renders only whole rows that fit (responsive card fallback below `lg`) | `columns`, `rows?` (SSR fallback: 8), `cardRows?`, `className?` |
| `components/app/page-size-select.tsx` | `PageSizeSelect` | Rows-per-page dropdown; syncs URL param, resets page | `value`, `paramName` ("limit"), `options` |
| `components/app/clear-filters-button.tsx` | `ClearFiltersButton` | Clears filter params from URL; hidden when none active | `paramKeys`, `defaultValues?` |
| `components/app/sign-out-confirm.tsx` | `SignOutConfirmDialog` | Controlled logout confirm dialog | `open`, `onOpenChange` |
| `components/app/sign-out-link.tsx` | `SignOutLink` | Sign-out button form wrapper | children |
| `components/app/slug-status-indicator.tsx` | `SlugStatusIndicator` | Workspace slug availability indicator — single persistent `aria-live="polite"` live region; text + icon (never color-only); statuses: idle/checking/available/taken/invalid | `status: SlugStatus`, `t: ReturnType<typeof useTranslations>` (must expose `slugChecking`, `slugAvailable`, `slugTaken`, `slugInvalid` keys) |
| `components/app/empty-state.tsx` | `EmptyState` | "No data yet" placeholder for list surfaces — dashed-border card, decorative icon, heading, optional description + action. Used by clients/teams tables, the inquiry table, and the notifications list. | `icon: LucideIcon`, `title`, `description?`, `action?: ReactNode`, `className?` |
| `components/app/client-match-dialog.tsx` | `ClientMatchDialog`, `ClientMatchCard`, `ClientMatchResolution` | Two-step name-collision dialog: pick an existing client card or "new client" escape, then (only if fields conflict) reconcile differing `email`/`phone`/`notes` via `lib/clients/reconcile.ts`'s `reconcileClient`; skips the reconcile step entirely when there are zero conflicts. `mode` only changes the escape-option and submit-button copy (create vs link) — shared by client creation and (planned) inquiry-to-client linking. | `open`, `matches: ClientMatchCard[]`, `typed: {name,email,phone,notes,tags}`, `mode: "create"\|"link"`, `onResolve: (r: {clientId,picks}\|{createNew:true}) => void`, `onCancel: () => void` |

## 3. Hooks

| Import | Export | Signature | Purpose |
|--------|--------|-----------|---------|
| `hooks/use-mobile.ts` | `useIsMobile` | `() => boolean` | Mobile viewport (<768px) via media-query listener |
| `hooks/use-guarded-action.ts` | `useGuardedAction` | `(action, { onError? }) => { loading, trigger }` | Wrap async action: loading state, blocks concurrent invocations |
| `lib/hooks/useGlobalContactTrigger.ts` | `useGlobalContactTrigger` | `(open: () => void) => void` | Register global contact-modal opener; cleans up on unmount |
| `lib/page-builder/brandKitContext.tsx` | `useBrandKit` | `() => PortfolioBrandKit` | Read current workspace brand kit (throws outside provider) |
| `hooks/useSlugAvailability.ts` | `useSlugAvailability`, `SlugStatus` | `(slug: string, currentSlug?: string) => { status: SlugStatus }` | Debounced (400ms) slug availability check via `checkSlugAvailabilityAction`; stale-response-safe via monotonic seq counter; statuses: idle/checking/available/taken/invalid; idle when slug is empty or equals currentSlug (own workspace) |
| `hooks/useImageRetry.ts` | `useImageRetry` | `(src: string \| undefined \| null) => { src, failed, onError }` | Retries a broken `<img>` load with backoff (1s/2s/3s) before flagging `failed`, to ride out Cloudflare Images' brief post-upload delivery-URL propagation delay; cache-busts each retry via a `?retry=n` query param; resets whenever `src` changes |
| `hooks/use-live-refresh.ts` | `useLiveRefresh` | `(entityTypes: string[], skip?: boolean) => void` | Soft `router.refresh()` when a live notification (`NotificationProvider`'s socket.io `notification:new`) arrives for one of the given entity types (`"team"`, `"inquiry"`, `"booking"`); skips the initial mount. Must be used within `NotificationProvider` (throws otherwise). Pass `skip` while a local detail view/modal is open to avoid clobbering in-progress edits with a background refresh. Reuses the existing notification transport — does not add new socket events or notification types. |
| `lib/i18n/rtl.ts` | `isRtl`, `useIsRtl` | `isRtl(locale: string) => boolean` / `useIsRtl() => boolean` | Single source of truth for RTL locale detection. `isRtl` is pure (use in Server Components, e.g. the root layout `dir`); `useIsRtl` is the client hook reading the active request locale. Keep the `"ar"` literal here only. |
| `lib/i18n/relativeTime.ts` | `formatRelativeTime` | `(date: Date \| string, locale: string) => string` | Locale-aware relative time via `Intl.RelativeTimeFormat(locale, {numeric:'auto'})`. Buckets: <60 s → seconds, <60 m → minutes, <24 h → hours, <7 d → days; ≥7 d falls back to `toLocaleDateString(locale, {month:'short', day:'numeric'})`. Use this everywhere instead of hand-rolled formatters. |
| `hooks/use-lemon-squeezy-checkout.ts` | `useLemonSqueezyCheckout` | `(onCheckoutSuccess: () => void) => { ready, open(url: string) => boolean }` | Loads Lemon Squeezy's `lemon.js` overlay script once per mount, wires its `Checkout.Success` event to the given callback. `open(url)` triggers the overlay; returns `false` (without opening anything) when the script hasn't finished loading, so callers can surface their own "not ready" message. Used by both the onboarding plan step and the settings billing panel — extract any third checkout-triggering surface onto this hook instead of re-injecting the script. |

## 4. Helpers / utilities

### `lib/utils.ts` & `lib/utils/`
| Import | Export | Signature | Purpose |
|--------|--------|-----------|---------|
| `lib/utils.ts` | `cn` | `(...ClassValue[]) => string` | Merge Tailwind classes (clsx + twMerge) |
| `lib/utils/format-currency.ts` | `formatMoney` | `(amount, currency, locale) => string` | Localized currency via Intl.NumberFormat |
| `lib/utils/csv-parse.ts` | `parseCsv` | `(text) => { headers, rows }` | RFC-4180 CSV parser (quotes, CRLF/LF) |
| `lib/utils/csv-parse.ts` | `normalizeCsvHeader` | `(raw) => string` | Map raw header → camelCase |
| `lib/utils/csv-parse.ts` | `stripFormulaGuard` | `(value) => string` | Reverse the export-side apostrophe guard; leaves a genuinely apostrophe-led value alone |
| `lib/utils/csv-serialize.ts` | `serializeCsv`, `serializeRow`, `quoteField` | rows/headers → CSV | RFC-4180 serialize (CRLF) |
| `lib/utils/csv-serialize.ts` | `escapeSpreadsheetText` | `(value) => string` | Prefix `'` before a leading `=+-@`/tab so exported text can't execute as a formula. **Text columns only** — prefixing a numeric column corrupts a negative amount |
| `lib/utils/xlsx.ts` | `parseXlsxToRows`, `rowsToXlsxBuffer`, `looksLikeXlsx` | `(buffer) => {headers, rows}`; `(headers, rows) => Buffer`; `(bytes) => boolean` | XLSX both directions via exceljs; every cell coerced to string so XLSX and CSV share one validator. **`server-only`** — never import from a client component |
| `lib/utils/handleActionResult.ts` | `toastActionResult` | `(result, successMessage) => result is {ok:true}` | Toast error/success + type-guard for server-action results |
| `lib/utils/fieldMessage.ts` | `fieldMessage` | `(error: {message?:unknown}\|undefined) => string\|undefined` | Narrow RHF `errors.<field>` to a plain string for `<p>{...}</p>` render — needed when the resolver schema is a ZodEffects (`.superRefine`) whose generic wrapper collapses input/output typing to `any` |
| `lib/utils/timezone.ts` | `wallTimeInTzToUtc` | `(date, time, tz) => ISO` | Wall-clock in IANA tz → UTC ISO |
| `lib/utils/timezone.ts` | `dayBoundInTz` | `(dateStr, tz, h, min, sec, ms) => Date` | DST-aware day-bound UTC Date |
| `lib/utils/timezones.ts` | `formatUtcOffset`, `TIMEZONE_GROUPS` | — | Offset formatting; grouped tz options |
| `lib/utils/time-format.ts` | `formatTime`, `formatTimeRange`, `formatRangeFromParts`, `DEFAULT_TIME_MODE`, `TIME_INPUT_LANG` | — | Display Date/time range as 24h/12h; `formatRangeFromParts(startHHMM, endHHMM, mode)` is the shared primitive both `formatTimeRange` and `formatSessionTimeRange` delegate to — use it when you already have wall-clock HH:MM strings |
| `lib/utils/get-user-time-format.ts` | `getUserTimeFormat` | `() => Promise<TimeMode>` | Read user time-format pref from cookie (fallback 24h) |
| `lib/utils/iso-week.ts` | `addDaysStr`, `weekStartMonday`, `isoWeekStartDate`, `isoWeekOf` | `("YYYY-MM-DD", n) => str`; `(str) => Monday str`; `(isoYear, isoWeek) => Monday str`; `(str) => {isoYear, isoWeek}` | Pure ISO-8601 week-string arithmetic, no tz — safe for both server and client (`"use client"`) files |
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
| `lib/db/scriptGuard.ts` | `parseDbTarget(uri)`, `printDbFingerprint(uri)`, `assertSafeTarget(uri, opts?)` | Target-safety guard for one-off DB scripts (migrations, reindex, backfills). `parseDbTarget`/`printDbFingerprint` extract/log only `{host, dbName}` — never credentials or the query string. `assertSafeTarget` throws unless a dev-looking target (`localhost`/`127.0.0.1` host or `dev`/`test`/`local` in the db name) gets `--allow-dev`, or a production-looking target gets `--i-understand-production` / `CONFIRM_PRODUCTION=1`; `--dry-run` (or `opts.dryRun`) downgrades both checks to a `console.warn` so read-only previews never need confirmation. Flags/env are read from `process.argv`/`process.env` by default, overridable via `opts` for tests. Wired into `lib/db/reindex.ts`, `scripts/backfill-inquiries.ts`, and every `lib/db/migrations/*.ts` file — use it for any new DB script instead of connecting/dropping unchecked. |
| `lib/db/clientTransactions.ts` | `recordBookingForClient`, `reassignBookingBetweenClients` | Atomic client financial-footprint writes |
| `lib/db/queries/inquiry-conflicts.ts` | `computeInquiryConflicts(workspaceId, inquiries, tz)`, `sessionConflictsWithBookings(workspaceId, tz, session, excludeBookingId?)` | Booking-only conflict detection for inquiries: bulk check across all inquiries (calendar list view) or single-session check (reschedule action); one Booking query per call |

### `lib/invoices/`
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/invoices/pdfShared.tsx` | `buildInvoiceStyles(theme)`, `DocumentHeader`, `DocumentFooter`, `InfoGrid`, `PdfTheme`, `InfoCell` | Shared `@react-pdf/renderer` layout: themed full-bleed header/footer color blocks + accent strip, and the 4-col labeled info grid. Used by both `InvoiceDocument` and `ReceiptDocument` — reuse for any future PDF document instead of re-styling. |
| `lib/invoices/filename.ts` | `buildPdfFilename({business, customer, kind, date?})` | Sanitized `BUSINESS-CUSTOMER-KIND_YYYY-MM-DD.PDF` filename builder for invoice/receipt downloads |
| `lib/invoices/counter.ts` | `getNextInvoiceSeq(workspaceId)`, `formatInvoiceNumber(seq)` | Atomic per-workspace sequence via the `Counter` model (`findOneAndUpdate` upsert) + `INV-NNNNNN` formatter |
| `lib/invoices/theme.ts` | `INVOICE_THEME_PRESETS`, `resolveInvoiceTheme(theme)` | Invoice PDF color presets (classic/slate/navyGold/forest) + resolver honoring a `"custom"` preset |

### `lib/email/`
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/email/escapeHtml.ts` | `escapeHtml(value) => string` | HTML-escape any value (handles null/undefined, escapes `&<>"'`). Use for all user-supplied strings in HTML output. |
| `lib/email/brand.ts` | `Brand`, `gallurioBrand()`, `resolveWorkspaceBrand(ws)`, `ctaTextColor(accentHex)` | Typed brand struct + factory functions. `gallurioBrand()` returns the platform brand; `resolveWorkspaceBrand(ws)` derives a partner brand from a workspace doc; `ctaTextColor` picks `#ffffff` or `#1a1a1a` for readable CTA button text via WCAG relative luminance. |
| `lib/email/layout.ts` | `EmailBlock` (incl. `divider` variant), `RenderEmailOpts`, `LocaleContent`, `LANGUAGE_NAME`, `renderBrandedEmail(opts) => { html, text }`, `bilingualSubject(en, localized, locale)`, `renderBilingualEmail({ brand, preheader, secondaryLocale, build }) => { html, text }` | Branded transactional email renderer. Table-based, 600px, fully inline styles, platform/partner modes, dark-mode `@media` block, bulletproof CTA buttons, plain-text fallback. `divider` block renders a thin rule with optional uppercase label. `renderBilingualEmail` builds English-first then appends workspace-locale section separated by a divider (no-op when `secondaryLocale === "en"`). `bilingualSubject` produces `"EN · LOC"` subject or plain English when locale matches. Every caller string is HTML-escaped internally. |
| `lib/email/messages.ts` | `EMAIL_COPY`, `emailLocale` | Typed, multi-locale (en/fil/ms/id) copy map for all transactional emails. Always add new email copy here; never hardcode strings in senders. `emailLocale` wraps `localeForCountry` for workspace-locale resolution. |
| `lib/email/send.ts` | `sendEmail(input)`, `SendEmailInput`, `SendEmailResult`, `logEmailFailure(emailType, to, result)` | Low-level Resend gateway. All email senders must go through this; handles API key guard, timeout, and error logging. Missing `RESEND_API_KEY` is a silent dev-only skip-success — in production it returns `{ ok: false, error: "no_transport" }`. `logEmailFailure` is the shared, redacted (no recipient address/body, just type + count + error code) failure log used by the critical sender wrappers (verification, password reset, team invite, lifecycle). |
| `lib/email/teamInvite.ts` | `sendTeamInviteEmail(input)`, `TeamInviteEmailInput` | Branded team-invite email (workspace-branded, locale-aware, with teams list). |
| `lib/email/inquiryNotification.ts` | `sendInquiryNotification(data)`, `InquiryNotificationData` | Branded internal notification email to the workspace owner when a new inquiry arrives. Platform-branded (teal). |
| `lib/email/inquiryClientConfirmation.ts` | `sendInquiryClientConfirmation(data)`, `InquiryClientConfirmationData` | Branded confirmation email to the client after they submit an inquiry. |
| `lib/email/sendPasswordResetEmail.ts` | `sendPasswordResetEmail(email, token, locale) => Promise<SendEmailResult>` | Branded password-reset email with locale-aware copy from `EMAIL_COPY.passwordReset`. Returns the `SendEmailResult` (logs via `logEmailFailure` on failure) — never throws. |
| `lib/email/notifications.ts` | `sendNotificationEmail(opts)` | Sends an in-app notification as a branded email digest when the recipient has email notifications enabled. |
| `lib/email/booking/bookingConfirmed.ts` | `sendBookingConfirmedClient(params)`, `sendBookingConfirmedOwner(params)`, `BookingConfirmedClientParams`, `BookingConfirmedOwnerParams` | Branded booking-confirmed emails: client copy (workspace-branded) and owner copy (platform-branded). |
| `lib/email/booking/bookingCancelled.ts` | `sendBookingCancelledClient(params)`, `sendBookingCancelledOwner(params)`, `BookingCancelledClientParams`, `BookingCancelledOwnerParams` | Branded booking-cancelled emails: client copy (workspace-branded) and owner copy (platform-branded). |
| `lib/email/booking/inquiryDecline.ts` | `sendInquiryDeclineClient(params)`, `InquiryDeclineClientParams` | Branded inquiry-decline email to the client when an inquiry is declined. |
| `lib/email/lifecycle.ts` | `sendLifecycleEmail(stage, to, country)`, `LifecycleEmailStage` | Platform-branded lapse-lifecycle email (`preExpiry`/`expired`/`remind1`/`remind2`), locale via `emailLocale(country)`, CTA always to absolute `/subscribe`. Sent by `lib/db/jobs/billing-lifecycle-sweep.ts`. |

### `lib/notifications/`
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/notifications/types.ts` | `NotificationType`, `NotificationEntityType`, `NotificationVars`, `NotificationRecipient`, `SendNotificationOptions`, `SerializedNotificationPayload` | Shared notification type contracts. Import these instead of re-declaring. |
| `lib/notifications/send.ts` | `sendNotification(opts)` | Single entry point for creating in-app `Notification` docs and optionally sending notification emails. Use this instead of writing directly to the `Notification` collection. |
| `lib/notifications/messages.ts` | `buildNotificationContent(type, vars, locale)` | Builds `{ title, body }` from the i18n notification copy for a given type/vars/locale combo. Used by `sendNotification`. |
| `lib/notifications/recipients.ts` | `resolveTeamRecipients(workspaceId, teamId)`, `resolveStatusChangeRecipients({ workspaceId, teamId, ownerUserId, ownerEmail })` | Resolve `NotificationRecipient[]` for `sendNotification`. `resolveTeamRecipients` does the `TeamMembership`→`User` lookup scoped by `workspaceId`+`teamId` (deduped, tenant-isolated). `resolveStatusChangeRecipients` merges team members + the workspace owner, deduped by `workosUserId`. Use these instead of re-implementing the lookup at booking/notification call sites. |

### Other lib
| Import | Export | Purpose |
|--------|--------|---------|
| `lib/plans/entitlements.ts` | `planEntitlements`, `PLAN_ENTITLEMENTS` | Plan-tier limits lookup |
| `lib/billing/grantPlan.ts` | `grantPlan(workspaceId, { plan, expiresAt })` | Provider-agnostic plan grant: sets `Workspace.plan` + `planGrantExpiresAt` and CLEARS every `ls*` field (a grant is by definition not backed by an LS subscription). Use for any non-Lemon-Squeezy plan grant (beta tester, future promo codes) instead of a raw `Workspace.updateOne`. |
| `lib/billing/checkGrantExpiry.ts` | `expireGrantIfPast(workspace)` | Lazy grant-expiry check: if `planGrantExpiresAt` is set and past, downgrades to free (DB write + mutates the passed-in workspace object) and returns it. Call right after loading the workspace in any tenant-resolution gate, before onboarding/subscription checks. Already wired into `requireOrg`, `ownerContext`, `requireApiOrg`. |
| `lib/billing/availability.ts` | `isPaidBillingAvailable()` | Single source of truth for whether paid Lemon Squeezy checkout/portal are reachable, gated on `PAID_BILLING_ENABLED` (independent of `BETA_TESTER_ENABLED` and `NODE_ENV`). Call before any checkout/portal server logic and to gate the corresponding UI — used by `app/api/billing/checkout/route.ts`, `lib/actions/billing.ts`, `lib/env.ts`, and the onboarding plan / `/subscribe` / settings-billing pages. |
| `lib/billing/webhookOrdering.ts` | `resolveProviderEventTimestamp(attrs)`, `applyOrderedWorkspaceUpdate(filter, set, eventTimestamp)` | Out-of-order-event protection for any timestamped Workspace billing update. `resolveProviderEventTimestamp` reads `attributes.updated_at` (falling back to `created_at`) off a Lemon Squeezy resource, returning `null` if neither parses. `applyOrderedWorkspaceUpdate` applies a `$set` only if `eventTimestamp` is `null` (degraded fallback — always applies) or newer than the workspace's stored `lsLastEventAt`, and stamps `lsLastEventAt` atomically in the same update. Use this for every webhook/reconciliation write that could arrive out of order instead of a bare `Workspace.updateOne`. |
| `lib/billing/subscriptionSnapshot.ts` | `applySubscriptionSnapshot({filter, subscriptionId, customerId, rawStatus, variantId, renewsAt, eventTimestamp})` | Single application path for a Lemon Squeezy subscription snapshot — team-cap guard, no-downgrade-on-a-variantId-miss, terminal-status-refuses-promotion, and lifecycle-reset-on-entitled all encoded once. Shared by the webhook's created/updated/plan_changed handler (`lib/lemonsqueezy/webhookHandlers.ts`) and the onboarding done-page reconciliation safety net (`lib/actions/onboarding.ts`) — route any new Lemon Squeezy snapshot-application site through this instead of re-deriving the plan/team-cap logic. |
| `lib/lemonsqueezy/webhookHandlers.ts` | `LEMONSQUEEZY_WEBHOOK_HANDLERS`, `LemonSqueezyWebhookHandler` | Typed `Record<HandledLemonSqueezyEvent, handler>` registry the webhook route (`app/api/webhooks/lemonsqueezy/route.ts`) dispatches through instead of a switch — one entry per one of the 12 handled events (several event names share a handler, e.g. created/updated/plan_changed all route to the same upsert handler). Lemon-Squeezy-specific by design; do not generalize to other providers. |
| `lib/theme/themes.ts` | `resolveScheme`, `THEMES`, `SELECTABLE_THEME_IDS` | Theme defs + light/dark resolution |
| `lib/theme/appTheme.ts` | `AppRadius`, `AppThemeConfig`, `DEFAULT_APP_THEME`, `appThemeAttributes` | Typed app-shell theming seam: `AppRadius` = "sharp" \| "subtle" \| "rounded"; `appThemeAttributes(config)` returns `{ "data-radius": ... }` spread onto `<html>` in the layout; `DEFAULT_APP_THEME` = `{ radius: "subtle" }`. Extend here when adding accent/base/font presets — no component changes needed, only a new `globals.css` block + cookie resolver. |
| `app/globals.css` (`html[data-radius]` blocks) | CSS vars `--radius`, `--radius-surface` | Roundness seam: `html[data-radius="sharp"]` / `"subtle"` / `"rounded"` override the two radius tokens. Controls consume `--radius`; structural frames consume `--radius-surface`. Never set these inline — always go through the `data-radius` attribute driven by `appThemeAttributes`. |
| `lib/i18n/navigation.ts` | `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname` | Locale-aware navigation (next-intl) |
| `lib/i18n/request.ts` | default | next-intl per-request config |
| `lib/server/rateLimit.ts` | `rateLimit`, `__resetRateLimitForTests` | In-memory sliding-window limiter (best-effort, NOT distributed) |
| `lib/server/getClientIp.ts` | `getClientIp(headers: Headers)` | Resolves the visitor IP for rate-limiting/abuse control. Checks `CF-Connecting-IP` first (Cloudflare-set, unspoofable once the origin is firewalled to Cloudflare IP ranges — the launch config), then `x-vercel-forwarded-for`, then the first `x-forwarded-for` hop, then `x-real-ip`; returns `"unknown"` if none present. Used by `app/api/inquiries/route.ts`, `app/api/public/pageviews/route.ts`, and `app/[locale]/(auth)/_actions.ts`'s `getIp()`. Reuse for any new public/rate-limited endpoint instead of re-parsing headers. |
| `lib/server/gracefulShutdown.ts` | `gracefulShutdown(deps)` | Builds a SIGTERM/SIGINT handler: closes the HTTP server, then Socket.IO, then `stopWorld()`, then the Mongo connection, then exits — bounded by a timeout (default 10s) so a hung close still exits. Dependency-injected (`httpServer`, `io`, `stopWorld`, `closeMongoConnection`, `exit`, `timeoutMs?`) for testability; wired in `server.ts`. |
| `lib/teams/team-colors.ts` | `TEAM_COLOR_PALETTE`, `INACTIVE_TEAM_COLOR` | Client-safe team color presets |
| `lib/page-builder/brandKitContext.tsx` | `BrandKitProvider`, `useBrandKit` | Workspace brand-kit context |
| `lib/page-builder/responsive.ts` | `PF_PAGE_CONTAINER`, `PF_PAGE_CONTAINER_CSS`, `PF_RESPONSIVE_CSS`, `padVar`, `gridColsVar`, `masonryColsVar`, `PF_CONTAINER_NAME`, breakpoint consts | Portfolio block responsiveness via a single `pfpage` container scope + custom-property indirection. Mark the page surface with `PF_PAGE_CONTAINER` (public root render) or `PF_PAGE_CONTAINER_CSS` (editor canvas via `RootCanvasStyle`), inject `PF_RESPONSIVE_CSS` once, and have blocks reference `var(--pf-pad/...)` inline so they reflow on the public page AND in the editor viewport toggle. New blocks must reuse these helpers, not re-implement breakpoints. |
| `lib/page-builder/StyleToolkitField.tsx` | `RadiusButtons` | Segmented button row for corner-radius presets (None/0, S/4, M/8, L/16, Full/9999). `aria-pressed` on active preset; clicking active deselects (passes `undefined`). | `value: number \| undefined`, `onChange: (v: number \| undefined) => void` |
| `lib/page-builder/toolbarPrimitives.tsx` | `FloatingLabelInput` | Material-style floating-label text input for editor toolbars. CSS-only float via `peer` + `placeholder=" "`; real `<label htmlFor>` + `useId` for accessibility. Used in the ContactDetails Content tab inputs. | `label: string`, `value: string`, `onChange: (v: string) => void`, `type?: string` |
| `lib/page-builder/CountControl.tsx` | `CountControl` | Segmented "count" picker: optional Auto button (value=undefined), quick-pick buttons, and a styled number input for custom values. Used by the Columns block editor for both columns (1–6) and rows (Auto + 1–6). All control states wired (idle/hover/focus-visible/active/disabled). | `value: number \| undefined`, `onChange: (v: number \| undefined) => void`, `quickValues?: number[]` (default [1,2,3]), `min?: number` (1), `max?: number` (6), `allowAuto?: boolean` |
| `lib/page-builder/EditorDrawerSection.tsx` | `EditorDrawerSection`, `EditorDrawerGroup` | Shared collapsible drawer primitives for editor side-panels (Puck block panel + contact/header panels). `EditorDrawerSection` is a single uncontrolled collapsible section (no outer border). `EditorDrawerGroup` wraps sections with one outer `border border-border` and hairline `divide-y divide-border` between adjacent sections — flush Puck-style stacking, no gaps. All 3 editor side-panels (`StyleToolkitField` `DesignTab`/`LayoutTab`, `ContactPanelDialog`, `HeaderPanelDialog`) now use these. | `EditorDrawerSection: { title: string; defaultOpen?: boolean; children: ReactNode }` · `EditorDrawerGroup: { children: ReactNode }` |
| `lib/page-builder/EmojiTextInput.tsx` | `insertAtCaret`, `EmojiButton` | `insertAtCaret(el, emoji)` — pure helper: inserts emoji at caret or replaces selection, returns new string. `EmojiButton` — trigger button (aria-label "Insert emoji") with a 24-emoji inline picker popover; on select, calls `onChange` with the new caret-inserted value and returns focus to the input. | `insertAtCaret(el: HTMLInputElement \| HTMLTextAreaElement, emoji: string) => string`; `EmojiButton({ inputRef, onChange, className? })` |
| `lib/page-builder/blocks/GalleryGridBlock.tsx` | `GALLERY_MIN_HEIGHT`, `resolveBannerLayers`, `GalleryImage` | Shared banner/container helpers for gallery blocks. `GALLERY_MIN_HEIGHT: Record<ContainerHeight, string \| undefined>` maps height tokens to CSS values (`auto→undefined`, `short→"40vh"`, `medium→"60vh"`, `tall→"80vh"`). `resolveBannerLayers(images?)` maps `GalleryImage[]` to `{ id, src }[]` via `imageDeliveryUrl` (returns `[]` when images absent). `GalleryImage = { id: string; publicId: string; alt?: string }`. Imported by GalleryMasonry and FeaturedWork; do not duplicate. |
| `lib/page-builder/StyleToolkitField.tsx` | `GALLERY_CONTAINER_BLOCKS` | `Set<string>` of block types that behave as container-like gallery sections (`GalleryGrid`, `GalleryMasonry`, `FeaturedWork`). Used by `StyleToolkitField` to enable Banner in Content tab and Frame/Effects/Spacing/Layout drawers. |
| `lib/page-builder/styleToolkit.ts` | `buildColorWithOpacity(color, opacity)` | Mixes a CSS color with transparency using `color-mix`. Opacity 0-100; `>= 100` returns color unchanged (no overhead). Used by ButtonBlock for `buttonOpacity` and by PortfolioHeader's ContactButton (local copy; consolidate when next touched). Signature: `(color: string, opacity: number) => string`. |
| `lib/page-builder/toolbarPrimitives.tsx` | `FontFamilyRow` | Block-level font-family control: curated self-hosted keys + a Google Fonts shortlist dropdown + free-text entry for any other Google Fonts family name — both write the same `PortfolioFontSelection` value. Shared by all 3 font pickers in `StyleToolkitField` (fontFamily, labelFontFamily, valueFontFamily). `effectiveValue` shows the theme-coupled default (opacity-60), matching the other toolkit rows. | `value: PortfolioFontSelection \| undefined`, `effectiveValue?: PortfolioFontSelection`, `onChange: (v: PortfolioFontSelection \| undefined) => void`, `label?: string` |
| `lib/page-builder/fonts.ts` | `PortfolioFontSelection`, `GOOGLE_FONT_SHORTLIST`, `isGoogleFontSelection`, `googleFontFamilyName`, `toGoogleFontSelection`, `googleFontsCssUrl`, `googleFontSlug`, `collectGoogleFontFamilies` | Google Fonts support layered onto the curated font registry: a selection is either a curated `PortfolioFontKey` or a tagged `` `google:${string}` `` string, stored in the SAME fields (`BlockStyle.fontFamily`/`PortfolioBrandKit.headingFont`/`bodyFont`) — no parallel storage. `collectGoogleFontFamilies(value)` recursively walks any JSON-like value (Puck data, a brand kit) collecting every distinct family in use, for `GoogleFontLoader`. |
| `lib/page-builder/GoogleFontLoader.tsx` | `GoogleFontLoader` | Client component that injects a Google Fonts CSS2 `<link rel="stylesheet">` per family into `<head>` (deduped by a stable per-family DOM id). Used because `next/font/google` requires build-time-known families — font choice here is per-workspace runtime data. Mounted in `RootCanvasStyle` (editor canvas), `app/(public)/w/[orgSlug]/layout.tsx` (brand kit fonts), and `page.tsx`/`gallery/page.tsx` (per-block overrides). | `families: string[]` |
| `lib/page-builder/demoSession.ts` | `getOrCreateDemoSessionId`, `demoDraftKey`, `isDemoPromoClaimed`, `markDemoPromoClaimed`, `demoImageLibraryKey`, `readDemoImageLibrary`, `writeDemoImageLibrary`, `DemoLibraryImage`, `DEMO_SESSION_KEY`, `DEMO_PROMO_CODE`, `DEMO_PROMO_CLAIMED_KEY`, `DEMO_IMAGE_COUNT_KEY_PREFIX` | Client-only localStorage helpers for the public, unauthenticated Portfolio Maker demo (`EditorShell`'s `demoMode` prop). `getOrCreateDemoSessionId()` reads/generates a per-browser UUID; `demoDraftKey(sessionId)` builds the demo's draft-buffer key in a namespace distinct from the real editor's `gallurio:portfolio-draft:${slug}`. `isDemoPromoClaimed`/`markDemoPromoClaimed` track the one-time promo-code reveal. `readDemoImageLibrary`/`writeDemoImageLibrary` persist this session's uploaded-image list (`DemoLibraryImage[]`) under `demoImageLibraryKey(sessionId)` — the shared source of truth `DemoImagePicker.tsx`'s controls read/write, so every picker instance in one session sees the same uploaded images. All guard `typeof window === "undefined"`. |
| `app/[locale]/(app)/portfolio/_components/DemoGateModal.tsx` | `DemoGateModal`, `DemoGateType` | Single shared upsell-gate modal for the Portfolio Maker demo — parameterized by `gate: "imageCap" \| "blockCap" \| "publish" \| "theme" \| null`. Shows the gate's locked copy (`app.portfolioMakerDemo.gates.*`) + a "Sign up to build without restrictions" CTA to `/sign-up`, and appends a one-time promo-code reveal line on the first gate hit per session (via `demoSession.ts`). Owned/rendered by `EditorShell` when `demoMode`. | `gate: DemoGateType`, `onClose: () => void` |
| `lib/page-builder/demoPickerContext.ts` | `DemoPickerContext`, `useDemoPicker` | React context threading `{demoSessionId, onImageCapHit}` (or `null` in the real editor) from `EditorShell` down into `StyleToolkitField.tsx`'s image-picker call sites, without prop-drilling through `BannerSection`/`ContentInputs`/`ContainerBackgroundControls`. `useDemoPicker()` returns `null` safely with no provider (unlike next-intl's `useTranslations`) — existing non-demo call sites need no guard. | `useDemoPicker(): { demoSessionId: string; onImageCapHit: () => void } \| null` |
| `app/[locale]/(app)/portfolio/_components/DemoImagePicker.tsx` | `DemoSingleImageControl`, `DemoMultiImageControl` | Drop-in demo-mode swap for `lib/page-builder/galleryPicker/MediaField.tsx`'s `SingleImageControl`/`MultiImageControl` — same external prop shape, but backed by this session's uploaded-image library (`demoSession.ts`) instead of the real, auth-gated collections API. No collections mode (no demo equivalent — see `StyleToolkitField.tsx`'s FeaturedWork branch). Reads `demoSessionId`/`onImageCapHit` from `demoPickerContext.ts`; on `uploadDemoImage` returning `image_cap_reached`, closes its dialog and calls `onImageCapHit()` instead of showing a plain error. Copy via `useTranslations("app.portfolioMakerDemo.imagePicker")` — this surface is public-facing and localized, unlike the rest of `StyleToolkitField.tsx` (English-only editor chrome). | `DemoSingleImageControl({value: string, onChange})`; `DemoMultiImageControl({value: MediaPickerSelection[], onChange, max?})` |
| `lib/storage/uploadDemoImage.client.ts` | `uploadDemoImage`, `UploadDemoImageResult` | Demo-only sibling to `lib/storage/uploadImage.client.ts` — same client-side `validatePhotoFile`/dimension-read flow, but posts to the public `/api/portfolio-maker-demo/upload` route (keyed by `demoSessionId`, not `/api/images/direct-upload`). Returns a discriminated result instead of throwing, so callers can branch on `"image_cap_reached"` (open the upsell gate) vs `"rate_limited"`/`"upload_failed"`/`"invalid_file"` (plain inline error). | `uploadDemoImage(file: File, demoSessionId: string): Promise<{ok:true, image: UploadedImage} \| {ok:false, error: "image_cap_reached"\|"rate_limited"\|"upload_failed"\|"invalid_file"}>` |

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
| C-11 | Editor tab bar | `lib/page-builder/StyleToolkitField.tsx` (`TabHeader`), `app/[locale]/(app)/portfolio/_components/ContactPanelDialog.tsx` (inline), `app/[locale]/(app)/portfolio/_components/HeaderPanelDialog.tsx` (inline) | Near-identical "Setup / Design" tab bars (active `border-b-2` indicator, `text-xs font-medium` tabs). Differ only in tab labels and selection key. | `lib/page-builder/EditorTabBar.tsx` (params: `tabs`, `activeTab`, `onTabChange`) | med-high |
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
| L-8 | HMAC-SHA256-hex compute + `timingSafeEqual` verify | `lib/auth/oauthState.ts`, `lib/auth/activeWorkspace.ts`, `lib/lemonsqueezy/webhook.ts` | 3rd hand-written copy of `createHmac("sha256",...).digest("hex")` + length-check + `timingSafeEqual` (Lemon Squeezy's SDK ships no verify helper, unlike Paddle's `webhooks.unmarshal()`) | New `lib/server/hmac.ts` `verifyHmacHex(payload, secret, signatureHex)` — repoint all 3 call sites in one PR, not a byproduct of an unrelated change | med |

---

## Maintenance

- Keep entries accurate on move/rename/delete — a stale catalog wastes tokens.
- When extracting a candidate: build the shared module, repoint call sites, add
  tests, update all 4 locales, then move the entry from §5 into §1–§4.
- Recommended first extractions (quick, high-reuse, low-risk): C-1 view toggle,
  C-2 confirm dialog, C-4 status badge, C-3 unsaved-changes dialog, plus the
  logic quick wins L-1 (reuse `formatMoney`), L-3 clipboard hook, L-2 date-time
  formatter.
