# Phase 3 — Member Invites + Team Assignment + Reduced Member Nav

**Status:** not started
**Depends on:** Phase 1 (`planEntitlements`), Phase 2 (Team + TeamMembership models exist)
**Unlocks:** Phase 4 needs `getTeamsForUser` for visibility filtering; Phase 5 needs member-side calendar context

> See [README.md](./README.md) for context, locked decisions, and architecture summary.

## Goal

Owner invites a teammate via email. Clerk emails them. On accept they appear in `User.memberships`, owner assigns them to one or more teams (with optional lead flag). Members log in to a stripped-down sidebar with Bookings only.

## Files to create

### Guards

- `lib/auth/assertCanAddTeamMember.ts` — `assertCanAddTeamMember(teamId): Promise<void>`. Atomic per-team cap check via `Team.findOneAndUpdate({_id, memberCount: {$lt: maxMembersPerTeam}}, {$inc: {memberCount: 1}}, {new: true})`. If the update returns null, the team is full → throws `TeamSeatCapExceededError`. The caller is responsible for rolling back the `$inc` if downstream steps fail (write the `TeamMembership`, drain pending invite, etc.).
- `lib/auth/assertCanAddTeamMember.test.ts` — happy path + at-cap denial + concurrent-invite race (two parallel calls; only one succeeds).

### Pending-invite tracking

- `lib/db/models/pendingTeamAssignment.ts` — model + TTL index (auto-delete after 30 days = Clerk invite expiry):
  ```
  workspaceId: ObjectId (req, indexed)
  email: String (req, lowercased)
  teamIds: ObjectId[]
  leadOnTeamIds: ObjectId[]
  createdAt: Date (TTL: 30 days)
  // compound index: { workspaceId: 1, email: 1 } unique
  ```

### Server actions

- `app/[locale]/(app)/settings/teams/_invite-action.ts` — `inviteMemberAction({ email, teamIds[], leadOnTeamIds[] })`:
  1. `requireRole("owner")`. No plan gate.
  2. For each `teamId`, call `assertCanAddTeamMember`. On any failure, **roll back** prior `$inc`s and return a structured error naming the full team(s).
  3. Call `clerkClient.organizations.createOrganizationInvitation({ organizationId: workspace.clerkOrgId, emailAddress, role: "org:member", redirectUrl })`.
  4. Upsert `PendingTeamAssignment` keyed by `{workspaceId, email}`.
  5. The `$inc`s above reserve the seat slots; the webhook drain finalizes them. If the user never accepts, the TTL on `PendingTeamAssignment` triggers a cleanup job that decrements `memberCount` back. **Add that cleanup job in this phase**: `lib/db/jobs/release-expired-invite-seats.ts`, scheduled hourly.

- `app/[locale]/(app)/settings/teams/_member-action.ts` —
  - `assignMemberToTeamAction({ clerkUserId, teamId, role })` — checks `assertCanAddTeamMember`, writes `TeamMembership`.
  - `removeMemberFromTeamAction({ clerkUserId, teamId })` — deletes `TeamMembership`, `$inc memberCount: -1`.
  - `setLeadFlagAction({ clerkUserId, teamId, isLead })` — updates the membership doc's `role`.
  - `removeMemberFromWorkspaceAction({ clerkUserId })` — calls `clerkClient.organizations.deleteOrganizationMembership`, then deletes the user's TeamMemberships in this workspace, decrementing each team's `memberCount`.

### Team context resolver

- `lib/auth/teamContext.ts` — `getTeamsForUser(workspaceId, clerkUserId): Promise<{teamId, role}[]>`. Used everywhere that needs "what teams can this user see". Cached per request (use React `cache()`).
- `lib/auth/teamContext.test.ts`.

### UI

- `app/[locale]/(app)/settings/teams/_components/invite-form.tsx` — email + multi-select of teams + per-team lead toggle.
- `app/[locale]/(app)/settings/teams/_components/member-list.tsx` — workspace members table; per-row "manage teams" button.
- `app/[locale]/(app)/settings/teams/_components/team-assignment-modal.tsx` — assign/remove teams, set lead flag.
- `app/[locale]/(app)/settings/teams/_components/downgrade-block-modal.tsx` — surfaces the plan-downgrade block error from Phase 2 with a list of teams to delete first.

## Files to modify

- `app/api/webhooks/clerk/route.ts` — on `organizationMembership.created`:
  1. After upserting `User.memberships`, look up `PendingTeamAssignment` by `{workspaceId, email}`.
  2. For each `teamId` still valid (team not deleted, not over cap), create `TeamMembership` doc. The seat was already reserved at invite time (`$inc memberCount`), so **do not increment again**. Guard with "does this TeamMembership already exist?" to handle webhook retries.
  3. If any teamId is no longer valid, surface in the owner's notification feed.
  4. Delete the `PendingTeamAssignment` row.
- `components/app/app-sidebar.tsx` — filter the `NAV` array by `role`. Members see `[Bookings]` only. Hide the footer Settings button for members entirely (their Clerk profile is still reachable via UserButton).
- `proxy.ts` — for non-owner users, redirect attempts to `/dashboard`, `/clients`, `/inquiries`, `/gallery`, `/settings/*` (except their Clerk profile area) → `/bookings`.
- `lib/actions/dev.ts` — add a dev-only `seedMember(email)` helper for fast manual testing.

## Acceptance / verification

```bash
pnpm test --run invite
pnpm test --run teamContext
pnpm test --run assertCanAddTeamMember
pnpm dev   # owner invites self-with-second-email → check inbox → accept → verify membership + sidebar
```

Manual walkthrough:
- Invite at-cap team → error names the full team.
- Invite + accept → TeamMembership row created, sidebar shows only Bookings for the member.
- Owner deletes member from workspace → Clerk membership removed, all TeamMembership rows for them gone, `memberCount` decremented per team.

## Risks

- **Per-team cap race**: solved by the atomic `findOneAndUpdate` on `memberCount` (see `assertCanAddTeamMember`).
- **Clerk webhook idempotency**: webhook may fire twice. `TeamMembership` upsert + unique index on `{teamId, clerkUserId}` protects us. Crucially, the `memberCount $inc` must NOT run inside the webhook handler — it ran at invite time. Webhook just writes the TeamMembership row.
- **Pending-invite TTL**: if a user never accepts, the seat stays reserved until the hourly cleanup job releases it. Surface unaccepted invites in the owner's member list so they know.
- **Pending-assignment drain timing**: if the user accepts weeks later and a team has since been deleted or filled, the drain handler silently skips that team. Surface in the owner's notification feed.
