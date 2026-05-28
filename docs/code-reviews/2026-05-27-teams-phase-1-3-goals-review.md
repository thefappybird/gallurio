# Teams Phase 1-3 Goals Review

Branch: `feat/teams/management`  
Base: `dev`  
Review date: 2026-05-27  
Mode: Manual/local review

## Executive Verdict

Phase 1 is properly met.

Phase 2 is mostly met, but not fully met as written. The remaining gaps are the team-delete booking guard and the downgrade-block flow not being wired into a real billing downgrade interaction.

Phase 3 is substantially implemented, but I would not call it merge-ready yet. The main feature surface exists, and the previous obvious pending-invite TTL/double-release issues were improved, but there are still invite-seat accounting cases that can leave `Team.memberCount` wrong.

## Phase 1: Permissions & Plan-Gating Foundation

Verdict: **Met.**

Evidence:

- `lib/plans/entitlements.ts` defines the required plan caps: Free 1, Starter 3, Pro 15; all with 10 members per team.
- `lib/plans/entitlements.test.ts` covers exact values and the typed `Record<PlanTier, PlanEntitlements>` shape.
- `lib/hitpay/plans.ts` adds `entitlements` to each `PLAN_CATALOG` entry without changing the pricing catalog structure.
- `requireOrg()` already returns `workspace`, so consumers can access `workspace.plan`.

No Phase 1 blockers found.

## Phase 2: Team Model + Owner Teams Settings Panel

Verdict: **Mostly met, with remaining spec gaps.**

Met goals:

- `Team` and `TeamMembership` models exist with tenant-scoped fields and tests.
- `assertCanAddTeam` and tests exist.
- Team validators exist.
- Owner-only Settings > Teams panel exists.
- Owners can create, rename, recolor, and delete non-default teams.
- The Main team is bootstrapped in onboarding and via a migration.
- Locale keys exist across all five catalogs.
- HitPay webhook has a paid-tier downgrade guard.

Remaining gaps:

1. **Team deletion still does not check booking references.**
   - File: `app/[locale]/(app)/settings/teams/_actions.ts:151-158`
   - The Phase 2 spec says `deleteTeamAction` refuses to delete a team that still has bookings. The implementation still has a Phase 4 TODO and deletes memberships/team directly.
   - This may be intentionally deferred because `Booking.teamId` is Phase 4, but it means Phase 2 is not fully met as written.

2. **Downgrade-block modal exists but is not wired.**
   - File: `app/[locale]/(app)/settings/teams/_components/downgrade-block-modal.tsx`
   - `rg` only finds the component and locale keys; nothing imports or renders it.
   - The webhook logs and suppresses paid-tier downgrade plan changes when over cap, but there is no connected UI path that surfaces “delete N teams before downgrading.”

## Phase 3: Member Invites + Team Assignment + Reduced Member Nav

Verdict: **Implemented in broad strokes, not merge-ready.**

Met goals:

- `assertCanAddTeamMember` exists with atomic `$inc` under cap and tests, including concurrent calls.
- `PendingTeamAssignment` exists.
- Invite action exists and creates Clerk org invitations.
- Member assignment actions exist.
- `getTeamsForUser` exists and is tested.
- Invite form, member list, team assignment modal, and downgrade block modal components exist.
- Clerk webhook drains pending assignments into `TeamMembership` rows.
- Sidebar filters members down to Bookings only.
- `proxy.ts` redirects non-owner members away from owner-only surfaces.
- Dev `seedMember` helper exists.
- Expired invite cleanup route and `vercel.json` cron exist.

### Finding 1: Re-inviting over an existing pending invite can leak old reserved seats

- File: `app/[locale]/(app)/settings/teams/_invite-action.ts:69-74`
- File: `app/[locale]/(app)/settings/teams/_invite-action.ts:101-118`

The action reserves seats for the submitted teams, then upserts `PendingTeamAssignment` keyed by `{ workspaceId, email }`. If a pending row already exists for that email, the upsert overwrites `teamIds` with the new set without first releasing the seats reserved by the old row.

Concrete failure mode:

1. Owner invites `person@example.com` to Team A. Team A `memberCount` increments.
2. Before acceptance/revocation/expiry, owner invites the same email to Team B.
3. The action reserves Team B, overwrites the pending row to point at Team B, and the Team A reservation is no longer represented anywhere.
4. Future revoke/cleanup can only release Team B. Team A remains over-counted.

Suggested fix: reject an existing unreleased pending invite before reserving seats, or claim-and-release the old pending row before creating a replacement.

### Finding 2: `releasedAt` is set before seats are released, and stuck rows are never retried

- File: `lib/db/jobs/release-pending-invite-seats.ts:27-48`
- File: `lib/db/jobs/release-expired-invite-seats.ts:25-30`
- File: `lib/db/jobs/release-pending-invite-seats.test.ts:98-116`

`claimAndReleasePendingInvite()` marks `releasedAt` first, then decrements team seats, then deletes the pending row. If the process exits after setting `releasedAt` but before decrementing seats or deleting the row, the cron job excludes that row forever because it only scans `releasedAt: null`.

The test explicitly codifies this behavior: a row with `releasedAt` already set short-circuits without touching seats.

Suggested fix: use a recoverable state machine (`releaseStatus: pending | releasing | released`) with retry for stale `releasing` rows, or wrap the claim + seat release + delete in a transaction. At minimum, do not make `releasedAt` mean “seats definitely released” before the release is complete.

### Finding 3: Clerk webhook can drain a pending row that has already been claimed for release

- File: `app/api/webhooks/clerk/route.ts:161-207`
- Related: `lib/db/jobs/release-pending-invite-seats.ts:27-48`

The webhook looks up `PendingTeamAssignment` by `{ workspaceId, email }` without checking `releasedAt: null`. If an invite row is claimed for release but not deleted, the user can still accept the Clerk invite and the webhook can create `TeamMembership` rows even though seats may already have been released or are in an unknown release state.

Suggested fix: have the webhook only drain pending rows with `releasedAt: null`, and decide what to do if the invite was already released/expired.

## Verification

- `pnpm typecheck`: Passed.
- `pnpm lint`: Passed with four existing React Compiler warnings in bookings/branding files.
- `pnpm test`: Passed, 47 files / 297 tests.
- `pnpm build`: Failed in the sandbox because Google Fonts could not be fetched. Rerun with network access passed. The existing Next.js multiple-lockfile workspace-root warning remains.

## Recommendation

Do not merge yet if the bar is “Phase 1-3 goals are properly met.”

Fix the pending-invite replacement/release lifecycle first, then add regression tests for:

- re-inviting the same email while an unreleased pending invite exists,
- a stuck release marker after partial failure,
- webhook accepting an invite whose pending row has already been claimed/released.

After those are fixed, Phase 1-3 will be much closer to properly complete.
