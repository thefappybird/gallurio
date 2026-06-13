# Settings & Auth UI Enhancements — Execution Plan

> **Status:** Planned, NOT executed. The WorkOS migration on `migrate/auth-workos` is functional and will merge first. These are follow-up enhancements to be picked up as a separate task on a new branch from `dev`.
>
> **Scope owner decisions (already confirmed):**
> - Avatars: build full upload (not just copy fix).
> - Password change: in-app form (verify current password, then set new).
> - Workspace switcher: do **not** render a dropdown when the user belongs to only one workspace.
> - "One owner workspace per user": treated as a **separate backend task**, out of scope here (see Appendix).

---

## Context (verified in code)

- **Identity is WorkOS-only**; orgs/workspaces/memberships are MongoDB. See `CLAUDE.md` → "Auth & tenancy".
- Settings UI lives under `app/[locale]/(app)/settings/`:
  - Route: `[[...catchall]]/page.tsx` builds the `pages[]` array and renders `_components/settings-user-profile.tsx`.
  - Tabs today: `account`, `security`, `customize`, `workspace` (owner), `public-page` (owner), `billing` (owner), `dev-plan` (owner, dev), `danger` (owner).
  - Server actions: `_actions.ts`.
- Sidebar: `components/app/app-sidebar.tsx`; user dropdown (with hidden logout): `components/app/client-user-button.tsx`.
- Dropdown primitive: `components/ui/dropdown-menu.tsx` is a Base UI (`@base-ui/react` Menu) port. `DropdownMenuLabel` renders `Menu.GroupLabel`, which **requires** a `Menu.Group` ancestor.
- Cloudinary client upload helper: `lib/storage/uploadToCloudinary.ts` (signs via `/api/uploads/sign`); server-side delete: `destroyAsset()` in `lib/storage/cloudinary.ts`. Pattern reference: `settings/workspace/_branding-form.tsx`.
- `User` model already has `avatarUrl` and `avatarCloudinaryPublicId` fields (`lib/db/models/User.ts`).
- Auth user shape (`lib/auth/session.ts`): `{ workosUserId, email, name, avatarUrl }`, where `avatarUrl` is WorkOS `profilePictureUrl`.
- Password APIs available (`@workos-inc/node` v10): `authenticateWithPassword`, `updateUser({ password })`, `createPasswordReset`, `resetPassword`. `getClientId()` = `process.env.WORKOS_CLIENT_ID`.

---

## Task 1 — Fix Base UI error #31 on the workspace dropdown

**Error #31** = "MenuGroupRootContext is missing. Menu group parts must be used within `<Menu.Group>`." Triggered because `<DropdownMenuLabel>` is used without a wrapping `<DropdownMenuGroup>`.

**Affected call sites (both bugged):**
- `app/[locale]/(app)/settings/_components/settings-org-switcher.tsx` (label "yourWorkspaces", ~line 66).
- `components/app/client-user-button.tsx` (name/email label, ~line 57).

**Fix:** Wrap the `<DropdownMenuLabel>` (and its following separator/items, for correct group semantics) in `<DropdownMenuGroup>`. Import `DropdownMenuGroup` from `@/components/ui/dropdown-menu`.

```tsx
<DropdownMenuContent ...>
  <DropdownMenuGroup>
    <DropdownMenuLabel>{t("yourWorkspaces")}</DropdownMenuLabel>
    <DropdownMenuSeparator />
    {/* items */}
  </DropdownMenuGroup>
</DropdownMenuContent>
```

**Alt (consider):** harden the shared `DropdownMenuLabel` to render a plain styled element instead of `Menu.GroupLabel`, so it never requires a group. Lower-risk to fix the two call sites; revisit the component only if more bare-label usages appear (grep `DropdownMenuLabel`).

**Tests:** render each dropdown, open it, assert no throw + label visible. Update/extend `client-user-button` and org-switcher tests.

---

## Task 2 — Hide the workspace switcher for single-workspace users

**Files:** `settings/_components/settings-user-profile.tsx` (renders `SettingsOrgSwitcher`) and/or `settings-org-switcher.tsx`.

**Behavior:**
- `workspaces.length <= 1` → do **not** render the dropdown. Either render nothing, or show the single workspace name as static, non-interactive text in the bar.
- `workspaces.length >= 2` → render the switcher (with Task 1 fix).

**Notes:** `workspaceSwitcherItems` is already built in `page.tsx` from `userDoc.memberships`. Keep the membership-validated `setActiveWorkspaceAction` as-is. Mobile: ensure the static-name fallback truncates at 375px.

**Tests:** switcher renders with 2+ workspaces; renders static name (no `button`/menu) with exactly 1.

---

## Task 3 — Remove the Danger Zone tab

**Files:** `settings/[[...catchall]]/page.tsx`.
- Remove the `danger` entry from the `pages[]` array (~lines 221–232).
- Remove the `DangerPanel` import (~line 26) and the now-unused `AlertTriangle` import.
- Remove `"danger"` from `OWNER_ONLY_SLUGS` (~line 43).
- Delete `settings/danger/_panel.tsx` and its test (if any).

**Server actions:** `deleteWorkspaceAction` and `requestDataExportAction` in `_actions.ts` become unused. Decision for the executing task: either delete them (+ their tests) or leave them dormant. Prefer deleting if nothing else references them (grep first). Keep `destroyAsset`/`cancelSubscription` imports only if still used elsewhere in the file.

**Route behavior:** visiting `/settings/danger` will fall through to the "select a page" panel. Acceptable, or add a redirect to `/settings`.

**Tests:** update `page.test.ts` route-gating expectations (danger no longer present).

---

## Task 4 — Remove all user-facing "WorkOS" mentions

**Only user-facing string found:** `app.settings.account.avatarHint` = "Avatar is managed through your WorkOS profile."

**Files:** `messages/en.json`, `messages/fil.json`, `messages/ms.json`, `messages/id.json` (no `th.json` in repo).

**Action:** With Task 5 (avatar upload) landing, this hint becomes obsolete — replace with upload guidance (e.g. "Upload a square image, at least 200×200px.") or remove. If avatar upload is split out, at minimum reword to drop the provider name (e.g. "Manage your profile photo below."). Keep wording generic — never name the auth provider (now a CLAUDE.md rule).

**Sweep:** grep all `messages/*.json` and rendered components for `WorkOS`/`workos` in visible copy before closing.

---

## Task 5 — Build avatar upload (account tab)

**Goal:** let users upload/replace/remove a custom avatar stored on the `User` doc, preferred over the WorkOS `profilePictureUrl`.

**Display precedence:** custom `User.avatarUrl` (when `avatarCloudinaryPublicId` set) → else WorkOS `profilePictureUrl` → initials fallback. Update `getAuthUser()` consumers or the settings page loader to read the Mongo `User.avatarUrl`/`avatarCloudinaryPublicId` and pass an effective avatar URL into the panel. (The sidebar/`client-user-button` avatar should use the same effective URL for consistency — wire via the app layout that already loads the user.)

**Client (account panel):** mirror `workspace/_branding-form.tsx` upload UX:
- Hidden `<input type="file" accept="image/*">`, "Upload/Replace" + "Remove" buttons, preview, `uploading` state, image-type + 5MB guards.
- `uploadToCloudinary(file, { subfolder: "avatars" })` → returns `{ secure_url, public_id }`.
- Call new `updateAvatarAction({ avatarUrl, avatarCloudinaryPublicId })`.

**Server action — `updateAvatarAction`** in `settings/_actions.ts`:
- `getAuthUser()` guard.
- Zod-validate `{ avatarUrl: string|null, avatarCloudinaryPublicId: string|null }`.
- Read previous `avatarCloudinaryPublicId` from the `User` doc; update `User.avatarUrl` + `avatarCloudinaryPublicId`.
- If previous public id existed and changed/removed, `destroyAsset(previousId)` (swallow failure with `console.warn`, mirror branding action).
- `revalidatePath("/settings", "layout")`.
- **Do not** call WorkOS `updateUser` for the picture (AuthKit `profilePictureUrl` is not app-writable); keep custom avatar app-owned.

**Upload signing:** confirm `/api/uploads/sign` allows the `avatars` subfolder / is tenant-safe for a per-user upload (avatars are user-scoped, not workspace-scoped — verify the signer doesn't hard-require a workspace folder; adjust if needed).

**States/a11y:** idle/uploading/disabled on buttons; alt text; keyboard-activatable; mobile at 375px.

**Tests:** action updates User doc + deletes old asset on replace/remove; validation rejects bad input; not-authenticated guard. Component: upload happy path (mock `uploadToCloudinary`), remove path.

**Locales:** add avatar upload/replace/remove/hint keys to all 4 locales.

---

## Task 6 — Merge Account + Security into one tab, add in-app password change

**Goal:** single "Account" tab containing: Profile (avatar + name), Password, MFA. Drop the separate "Security" tab.

**Files:**
- `settings/account/_panel.tsx` — becomes the combined panel (compose existing name form + new avatar + new password section + the MFA UI moved from `security/_panel.tsx`). Consider extracting `MfaSetupFlow`/MFA section into a shared component imported by the account panel.
- `settings/[[...catchall]]/page.tsx` — remove the `security` page entry; render the combined panel under `account`. Keep passing `mfaEnabled`.
- Remove/redirect the `security` slug (catchall fallback is acceptable; or redirect `/settings/security` → `/settings`).
- `settings-user-profile.tsx` `SettingsPage.slug` union — drop `"security"`.

**Password change — client form (in account panel):**
- Fields: current password, new password, confirm new password. Zod: new password min 8 / max 128, confirm matches.
- Submit → new `updatePasswordAction`.

**Server action — `updatePasswordAction`** in `settings/_actions.ts`:
- `getAuthUser()` guard.
- Validate input (current present; new min 8/max 128; new === confirm).
- Verify current password: `workos.userManagement.authenticateWithPassword({ clientId: WORKOS_CLIENT_ID, email: authUser.email, password: current, session:{...} })`. On `AuthenticationException` → return generic "Current password is incorrect."
- Then `workos.userManagement.updateUser({ userId, password: newPassword })`.
- **OAuth-only users (no password set):** `authenticateWithPassword` will fail / there is no password — detect and return a clear message directing them to use the reset-password email flow (reuse `forgotPasswordAction` path) or surface a "set a password" CTA. Confirm exact WorkOS error code during implementation.
- Rate-limit (reuse `checkAuthRateLimit({ email, ip })`) to prevent current-password brute force. Note: needs `ip` via `headers()` like the auth actions.
- Never echo which field failed beyond "current password incorrect"; no account enumeration concerns here (already authenticated).

**Tab label/icon:** keep `account` (UserIcon). Remove `ShieldIcon` import if unused after merge (MFA section can keep a shield icon inline).

**Tests:**
- `updatePasswordAction`: success path (mock authenticate + updateUser), wrong current password, mismatch/validation, OAuth-no-password path, rate-limit.
- Account panel renders profile + password + MFA sections; security route no longer a separate tab (`page.test.ts`).

**Locales:** add password section keys (labels, errors, success, OAuth-user notice) to all 4 locales; move/merge security/MFA keys under account namespace if reorganizing.

---

## Task 7 — Visible Logout button on the sidebar

**Why:** logout currently only exists inside the avatar dropdown (`client-user-button.tsx`), which was also hitting Base UI #31. User wants a directly visible control.

**File:** `components/app/app-sidebar.tsx` (footer `SidebarMenu`, alongside Theme toggle + Settings).

**Implementation:** add a `SidebarMenuItem` with a form-based logout matching the Settings button pattern:
```tsx
<SidebarMenuItem>
  <form action={signOutAction}>
    <SidebarMenuButton
      render={<button type="submit" />}
      tooltip={t("logOut")}
      className="group-data-[collapsible=icon]:mx-auto text-destructive"
    >
      <LogOutIcon className="size-5! shrink-0" />
      <span>{t("logOut")}</span>
    </SidebarMenuButton>
  </form>
</SidebarMenuItem>
```
- Import `signOutAction` from `@/lib/auth/signOut` and `LogOutIcon` from lucide-react.
- Reuse existing `app.sidebar.logOut` locale key (already present, used by `client-user-button`).
- Verify `SidebarMenuButton render={<button>}` works inside a `<form action>` (server action) when collapsed (icon-only) and expanded; keep tooltip for collapsed state.
- Decision: keep the logout in the avatar dropdown too (now fixed) or remove it there to avoid duplication. Default: keep both.

**Tests:** sidebar renders a logout control bound to `signOutAction`; visible in expanded and icon-collapsed states.

---

## Cross-cutting done criteria (per CLAUDE.md)

- All 4 locales (`en`, `fil`, `ms`, `id`) updated together for every new/changed string.
- Mobile checked at 375px for the account tab (avatar + password + MFA) and the sidebar logout.
- Loading / empty / error / populated states on async surfaces; idle/hover/focus-visible/active/disabled on controls.
- Tenant isolation respected (avatar/password actions are user-scoped via `getAuthUser`, not workspace-scoped — no `workspaceId` needed, but never trust client ids).
- `pnpm typecheck` + `pnpm lint` + affected tests pass before done.
- No user-facing "WorkOS" copy anywhere (grep sweep).

## Suggested execution order

1. Task 1 (dropdown fix) + Task 2 (switcher hide) — small, unblocks the reported crash.
2. Task 3 (remove danger) + Task 4 (copy sweep) — low risk.
3. Task 7 (sidebar logout) — isolated.
4. Task 5 (avatar upload) — new action + UI + signer check.
5. Task 6 (merge tabs + password) — largest; touches page.tsx, actions, locales.

---

## Appendix — out of scope here: "one owner workspace per user" enforcement

Onboarding (`lib/actions/onboarding.ts`) upserts `Workspace` keyed on `ownerUserId`, so the normal flow yields exactly one owned workspace per user (re-runs edit the same doc). This is **not** backed by a DB constraint — `Workspace.ownerUserId` has a non-unique index. If hard enforcement is desired ("subscribe again → new account"), add a **unique index on `Workspace.ownerUserId`** plus an application-level guard before the upsert, and a migration to catch existing duplicates. Track as its own backend task.
