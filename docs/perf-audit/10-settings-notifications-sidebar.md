# Perf audit: settings, notifications, sidebar — CLS

Scope: `app/[locale]/(app)/settings/[[...catchall]]/`, `app/[locale]/(app)/notifications/`,
`components/notifications/NotificationPopover.tsx`, `components/ui/sidebar.tsx`.

Trigger: user-observed CLS on settings' loading skeletons, asked whether it's systemic
elsewhere. It isn't — dashboard/clients/teams already follow the good pattern (see `08-*`/`09-*`).
Settings and notifications are the two real offenders: one generic, dimensionless skeleton
shape reused across structurally unrelated real content.

## What's working
- `components/ui/skeleton.tsx` (`Skeleton`) is a bare, dimensionless primitive by design —
  consumers own their own dimensions. That discipline is what's missing in the two gaps below,
  not a primitive defect.
- `NotificationPopover.tsx` correctly has no skeleton at all — it's server-hydrated via
  `initialNotifications`/`initialUnreadCount` props, no client fetch-on-open, so there's nothing
  to cover with a loading state.
- Teams' route-level `loading.tsx` (see `09-*`) is well-tuned on the row-height axis even though
  its row *count* is a guess — proof the `TableSkeleton` discipline works when applied.

## Gaps
- **Settings** (`settings/[[...catchall]]/loading.tsx`, one shared skeleton for 6 sub-routes):
  - Tab-rail chip is `flex` row at every breakpoint; real chip (`settings-user-profile.tsx`) is
    `flex-col` below `sm`, `sm:flex-row` above — direction differs on mobile.
  - Skeleton chip has no `border-b-2 border-transparent` (the real active-tab underline's
    reserved 2px); skeleton hides the label placeholder below `sm` entirely, while the real
    label is always visible (icon-over-label stacked on mobile).
  - Tab **count** hardcoded to 6; real count is 2 (non-owner), 5 (owner/prod), or 6 (owner/dev)
    depending on `role` + `IS_DEV` — `loading.tsx` can read neither (Next's `loading.tsx`
    receives no `params`/`searchParams`, confirmed against Next.js docs). Lower-priority than
    the chip structure bugs since the rail is a horizontally-scrollable strip — a count
    mismatch changes scrollable width, not page height.
  - **Panel body — worst finding in the whole audit.** Skeleton is a flat "1 heading + 4
    label/input rows" (~316px) reused for every tab. Real content per tab is structurally
    unrelated: `account` (the default `/settings` entry, most-hit) is 4 sectioned blocks
    (avatar upload, name form, password section, MFA status/QR) at roughly 3x the skeleton's
    height; `workspace` is grids + a `min-h-56` logo dropzone; `billing` is a plan-summary box +
    conditional banners + plan cards + a promo drawer; `customize` is button/swatch grids, no
    inputs at all; `public-page` is SEO fields + image upload + tags.
- **Notifications** (`notifications/loading.tsx` vs `NotificationsListPage.tsx`):
  - Skeleton body is a single `h-3` bar; real body is `line-clamp-2` and commonly wraps to 2
    lines for real notification copy — understates each of the fixed 6 skeleton rows by
    ~15-20px (~100px+ compounded).
  - Skeleton row has 2 flex children (icon, title+body); real row has a third — timestamp +
    unread dot — entirely unrepresented.
  - Header skeleton `h-6 w-32` (24px) vs real `text-xl` (28px line-height); the conditional
    "Mark all read" button reserves no space in the skeleton regardless of unread state.
  - The separate in-page "load more" skeleton (`NotificationsListPage.tsx:180-192`) has the
    identical single-line-vs-2-line mismatch.
- **Sidebar**: `components/ui/sidebar.tsx`'s `Sidebar` root renders a plain
  `<div data-slot="sidebar">` in all three branches (lines 183/201/228) — never `<nav>`/
  `role="navigation"`. Sole call site `components/app/app-sidebar.tsx:126` means every
  authenticated page (dashboard/clients/teams/notifications/settings/bookings/inquiries/
  portfolio) shares this one gap.

## Reviewed and declined
- Per-tab-exact settings skeletons via route restructuring (real nested routes per tab, each
  with its own `loading.tsx`): would fix every tab precisely, but is a bigger architectural
  change (routing, the existing client-side tab-intercept in `settings-user-profile.tsx`, its
  own test pass) than this wave is scoped for. Chosen instead: fix the shared skeleton's
  structural bugs and reshape its panel body after the `account` tab specifically, since it's
  the default/most-common cold-nav target. Other tabs stay approximated — accepted residual CLS,
  not a defect.
- `?tab=portfolio` dashboard cold-nav skeleton mismatch (see `08-*`): same root cause
  (`loading.tsx` can't read searchParams either) — declined for the same reason, and it's a
  rarer entry path than plain `/dashboard` or in-app tab switches (which use a client transition,
  not this route-level file).

## Fix direction
Settings: fix the tab-rail chip structure (direction/border/label-visibility) unconditionally;
replace the generic panel-body skeleton with one modeled on the `account` tab's real sections.
Notifications: two-line body skeleton, add the third (timestamp/dot) column, fix header
line-height, reserve "Mark all read" width unconditionally. Sidebar: wrap the `Sidebar` root in
`<nav aria-label="...">` (or add `role="navigation"`) — one change, fixes every authenticated
page's nav-landmark gap at once.
