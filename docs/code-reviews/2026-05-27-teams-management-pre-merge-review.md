# Teams Management Pre-Merge Review

Branch: `feat/teams/management`  
Base: `dev`  
Review date: 2026-05-27  
Mode: Manual/local review, CodeRabbit skipped

## Findings

### High: Lint fails on the new upsell link, and the target route does not exist

- File: `app/[locale]/(app)/settings/teams/_panel.tsx:503-509`
- Evidence: `pnpm lint` fails with `@next/next/no-html-link-for-pages` for the raw `<a href="/pricing#teams">`.
- Impact: This branch cannot pass the required pre-merge lint check. The build route list also has no `/pricing` route, and `rg -n pricing app components lib messages` only found this href plus unrelated booking copy, so capped users would likely land on a 404 even after replacing `<a>` with `Link`.
- Suggested fix: Point the CTA at a real route in this app, or add the actual pricing route. If the route is internal, use `next/link`.

### High: Subscription cancellation can leave cancelled accounts on paid entitlements

- File: `app/api/webhooks/hitpay/route.ts:127-148`
- Impact: When HitPay sends a cancelled/closed/failed event, the code sets `update.plan = "free"`, then deletes `update.plan` if the workspace has more teams than the free cap. That preserves the old paid `workspace.plan`, so entitlement checks continue treating the workspace as paid after cancellation.
- Suggested fix: Do not use the paid plan field as the blocked-over-cap state. Introduce an explicit over-limit/billing-blocked state or downgrade the plan while separately blocking team-dependent operations until the owner resolves excess teams.

### Medium: Team cap enforcement is raceable

- Files:
  - `lib/auth/assertCanAddTeam.ts:21-24`
  - `app/[locale]/(app)/settings/teams/_actions.ts:57-74`
- Impact: `createTeamAction()` checks `Team.countDocuments()` and then inserts in a separate operation. Two concurrent requests can both pass the count preflight and create teams beyond the plan cap.
- Suggested fix: Make the cap check atomic, for example by using a transaction/recheck strategy or a workspace-level counter/guard that cannot be bypassed by concurrent inserts. Add a concurrent-create regression test.

### Medium: Optimistic team edits do not roll back on failure

- File: `app/[locale]/(app)/settings/teams/_panel.tsx:108-116, 200-212, 286-295`
- Impact: Rename, color change, and delete dispatch optimistic UI updates before the server action resolves. If the action returns an error, the UI keeps the incorrect state until a refresh.
- Suggested fix: Revert the optimistic change on failure or force a server refresh after failed mutations.

### Medium: Team membership deletion is missing the tenant filter

- File: `app/[locale]/(app)/settings/teams/_actions.ts:159`
- Impact: `TeamMembership.deleteMany({ teamId: objectId })` omits `workspaceId`, violating the repo rule that every tenant-scoped mutation includes `workspaceId`. The preceding team lookup scopes ownership, so this is not an obvious cross-tenant exploit today, but the mutation should still remain tenant-bound.
- Suggested fix: Use `TeamMembership.deleteMany({ teamId: objectId, workspaceId: ctx.workspace._id })`.

### Medium: Server actions bypass the normal onboarding gate

- Files:
  - `lib/auth/ownerContext.ts:13-26`
  - `lib/auth/requireOrg.ts:29-31`
  - `app/[locale]/(app)/settings/teams/_actions.ts:48-163`
- Impact: The settings page uses `requireOrg()`, which redirects users without `onboardingCompletedAt`. The team server actions call `ownerContext()` directly, and `ownerContext()` only checks Clerk user/org and owner status. A not-yet-onboarded owner with an active org can call these actions directly.
- Suggested fix: Reuse `requireOrg()`/`requireRole("owner")` in the actions or mirror its onboarding check in `ownerContext()`. Add an action-level test for incomplete onboarding.

### Low: `ensureDefaultTeam()` is sequentially idempotent but not protected by a unique default-team index

- Files:
  - `lib/db/models/team.ts:28-42`
  - `lib/db/models/team.test.ts:86-96`
- Impact: `ensureDefaultTeam()` upserts on `{ workspaceId, isDefault: true }`, but the supporting index is not unique. Parallel onboarding retries or migration runs can still create duplicate default teams or hit duplicate-name errors through the separate `{ workspaceId, name }` unique index.
- Suggested fix: Add a partial unique index for one default team per workspace, then test parallel calls.

### Low: New action and webhook paths need direct tests

- Files:
  - `app/[locale]/(app)/settings/teams/_actions.ts`
  - `app/api/webhooks/hitpay/route.ts`
  - `app/[locale]/(app)/settings/teams/_panel.test.tsx:1-175`
- Impact: The panel has render-level coverage with mocked actions, and the model/entitlement helpers are covered, but the server action branches and the new HitPay downgrade behavior are not directly tested. These are the riskier parts of the branch.
- Suggested fix: Add focused tests for invalid IDs, duplicate names, tenant isolation, cap enforcement, auth/onboarding rejection, and the cancellation/downgrade webhook path.

### Low: Interactive cap CTA is marked as aria-disabled

- File: `app/[locale]/(app)/settings/teams/_panel.tsx:650-656`
- Impact: At cap, the button remains intentionally clickable to open the upsell dialog, but it is announced as disabled via `aria-disabled="true"`.
- Suggested fix: Either remove `aria-disabled` for the interactive upsell trigger or make the disabled state real and expose the upgrade action separately.

## Verification

- `pnpm typecheck`: Passed.
- `pnpm lint`: Failed. New blocking errors are in `app/[locale]/(app)/settings/teams/_panel.tsx:504` for raw `<a>` navigation to `/pricing/`. Existing React Compiler warnings also appear in bookings and branding files.
- `pnpm test`: Passed, 41 files / 269 tests.
- `pnpm build`: First run failed because the sandbox could not fetch Google Fonts. Rerun with network access passed. Build warning remains about Next.js inferring the workspace root because multiple lockfiles exist.

## Notes

No code changes were made as part of this review.
