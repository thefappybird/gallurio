# Teams Phase 3 Review

Branch: `feat/teams/management`  
Base: `dev`  
Review date: 2026-05-27  
Mode: Manual/local review

## Verdict

Phase 3 is now substantially implemented. The branch includes the invite UI/actions, pending team assignments, atomic team-seat guard, team assignment UI, member-only sidebar filtering, proxy redirects, Clerk webhook drain, and hourly cleanup route.

I would not merge it yet. The remaining blockers are around the pending-invite seat lifecycle. Because `Team.memberCount` is the source of truth for per-team caps, any double-release or missed-release bug can block valid invites or make caps inaccurate.

## Findings

### High: Mongo TTL can delete pending invites before seats are released

- File: `lib/db/models/pendingTeamAssignment.ts:18`
- File: `lib/db/jobs/release-expired-invite-seats.ts:23`

`PendingTeamAssignment.createdAt` has a Mongo TTL `expires`, but the cleanup job needs the pending row to know which team seats to release. Mongo TTL deletion does not run application cleanup logic. If Mongo deletes the document before the hourly cron sees it, the reserved `Team.memberCount` seats are never refunded.

Suggested fix: remove the TTL auto-delete and let the cleanup job own release + deletion, or add a separate durable release marker/state so the cleanup can release seats before the row disappears.

### High: Invite seat release is not idempotent

- File: `lib/db/jobs/release-expired-invite-seats.ts:32-40`
- File: `app/[locale]/(app)/settings/teams/_invite-action.ts:170-174`

Both the cron cleanup and invite revoke path decrement `memberCount` before deleting the pending row. If the process fails after decrementing but before delete, or if the same operation retries, the same invite can release the same seats multiple times.

Suggested fix: make release a one-time state transition, for example by atomically claiming the pending row with `releasedAt: null`, setting `releasedAt`, then decrementing; or by using a transaction. The important property is that a pending invite can only release its seats once.

### Medium: Clerk invite can survive without a pending assignment

- File: `app/[locale]/(app)/settings/teams/_invite-action.ts:92-132`

The action creates the Clerk organization invitation first, then writes `PendingTeamAssignment`. If the pending assignment write fails, the code releases reserved seats but leaves the Clerk invite alive. When the user accepts that invite, they join the org but the webhook has no pending assignment to drain, so they get no `TeamMembership` rows.

Suggested fix: either persist pending assignment before sending the Clerk invite, or revoke the Clerk invitation in the `PendingTeamAssignment.findOneAndUpdate()` catch path.

### Medium: Team assignment can create ghost memberships

- File: `app/[locale]/(app)/settings/teams/_member-action.ts:34-82`

`assignMemberToTeamAction()` verifies the team belongs to the workspace, but it does not verify that the submitted `clerkUserId` belongs to the workspace/org. The UI only offers real workspace members, but direct server-action calls can create `TeamMembership` rows and consume seats for arbitrary Clerk user IDs.

Suggested fix: before reserving a seat, check `User.findOne({ clerkUserId, "memberships.workspaceId": ctx.workspace._id })` or verify the Clerk org membership.

## What Looks Good

- `assertCanAddTeamMember()` uses atomic `findOneAndUpdate` with `memberCount: { $lt: maxMembersPerTeam }`.
- Member sidebar filtering is wired via `AppSidebar` role props.
- `proxy.ts` redirects non-owner users away from owner-only app surfaces.
- Clerk webhook drains pending assignments into `TeamMembership` rows on org membership creation.
- The branch adds focused tests for `assertCanAddTeamMember` and `teamContext`.

## Verification

- `pnpm typecheck`: Passed.
- `pnpm lint`: Passed with four existing React Compiler warnings in bookings/branding files.
- `pnpm test`: Passed, 45 files / 290 tests.
- `pnpm build`: First sandboxed run failed because Google Fonts could not be fetched. Rerun with network access passed. The Next.js multiple-lockfile workspace-root warning remains.

## Recommendation

Fix the pending-invite release lifecycle before merge. Once release is idempotent and TTL cannot erase unreleased reservations, this Phase 3 branch will be much closer to merge-ready.
