# Phase 2 — Team Model + Owner Teams Settings Panel

**Status:** not started
**Depends on:** Phase 1 (`planEntitlements`)
**Unlocks:** Phase 3 (member invites need Team to exist), Phase 4 (Booking.teamId references Team)

> See [README.md](./README.md) for context, locked decisions, and architecture summary.

## Goal

Owners on **every** plan can create/rename/delete teams within their plan's `maxTeams` cap. Clicking "Create team" when at-cap surfaces the upsell. Every workspace gets a permanent "Main" team. No invites yet, no booking linkage yet.

## Files to create

### Models

- `lib/db/models/team.ts`
  ```
  workspaceId: ObjectId (req, indexed)
  name: String (req, 1..40)
  color: String (req, hex; default from a 6-color palette)
  isDefault: Boolean (default false) — true only on the Main team
  memberCount: Number (default 0) — denormalized for atomic cap check (Phase 3 will rely on this)
  createdByClerkUserId: String (req)
  createdAt / updatedAt (timestamps)
  // compound index: { workspaceId: 1, name: 1 } unique — no two teams in one workspace share a name
  // compound index: { workspaceId: 1, isDefault: 1 } — fast Main-team lookup
  ```
- `lib/db/models/teamMembership.ts` (separate doc, not embed — keeps queries simple and avoids document-size growth)
  ```
  workspaceId: ObjectId (req, indexed)
  teamId: ObjectId (req, indexed, ref Team)
  clerkUserId: String (req, indexed)
  role: "member" | "lead" (default "member")
  createdAt / updatedAt
  // compound indexes:
  //   { workspaceId: 1, clerkUserId: 1 } — "what teams is this user in inside this workspace"
  //   { teamId: 1, clerkUserId: 1 } unique — no duplicate membership per team
  ```
- `lib/db/models/team.test.ts`, `lib/db/models/teamMembership.test.ts` — tenant-isolation tests using `mongodb-memory-server` per CLAUDE.md rule.

### Guards & validators

- `lib/auth/assertCanAddTeam.ts` — `assertCanAddTeam(workspaceId): Promise<void>`. Counts current teams for the workspace, compares to `planEntitlements(workspace.plan).maxTeams`, throws typed `TeamCapExceededError` (carries plan + currentCount + max so the UI can render the upsell).
- `lib/auth/assertCanAddTeam.test.ts` — happy path + at-cap denial per tier.
- `lib/validators/team.ts` — Zod schemas for create/rename/color.

### Settings panel

- `app/[locale]/(app)/settings/teams/_actions.ts` — server actions: `createTeamAction`, `renameTeamAction`, `setTeamColorAction`, `deleteTeamAction`. Each calls `requireRole("owner")`. `createTeamAction` calls `assertCanAddTeam`; on `TeamCapExceededError`, returns a typed error the form translates into the upsell card. `deleteTeamAction` refuses to delete the Main team (`isDefault: true`) and refuses to delete any team that still has bookings (forces explicit reassignment).
- `app/[locale]/(app)/settings/teams/_panel.tsx` — server component panel rendered in `<CustomPage slug="teams">`. Always renders the teams list + create form. Create button is disabled when `currentTeamCount >= maxTeams`; clicking the disabled state opens the upsell sheet (skipped on Pro since they can't upgrade further).
- `app/[locale]/(app)/settings/teams/_components/teams-upsell-sheet.tsx` — reusable upsell surface, linking to `/pricing#teams`.
- `app/[locale]/(app)/settings/teams/_panel.test.tsx` — render smoke + at-cap upsell branch + create/rename/delete happy paths.

### Bootstrap migration

- `lib/db/migrations/2026-XX-default-team-bootstrap.ts` — for **every** workspace (Free included), ensure a "Main" team exists (idempotent `findOneAndUpdate` with `upsert: true` keyed on `{workspaceId, name: "Main"}`). Run once on deploy.

## Files to modify

- `lib/actions/onboarding.ts` — after workspace upsert, ensure the new workspace's Main team is created (call into the same idempotent helper used by the bootstrap migration). New users get their Main team immediately.
- `app/[locale]/(app)/settings/[[...catchall]]/page.tsx` — register `<CustomPage slug="teams" url="/settings/teams" labelKey="teams.title" icon={UsersRoundIcon} ownerOnly />`. Add `"teams"` to `OWNER_ONLY_SLUGS`.
- `messages/{en,fil,ms,id}.json` — add `settings.teams.*` keys (machine-translate non-English at the end of the phase).
- `app/[locale]/(app)/settings/_components/settings-user-profile.tsx` — render the new panel for the `/settings/teams` URL.
- `app/api/webhooks/hitpay/route.ts` (or wherever the plan-change handler lives) — add a guard: refuse the plan transition if `currentTeamCount > newPlan.maxTeams`. Throw a structured error the billing UI can translate into "Delete N team(s) before downgrading". The block-modal UI for this ships in Phase 3 alongside the rest of Team-settings UI.

## Acceptance / verification

```bash
pnpm test --run team
pnpm test --run assertCanAddTeam
pnpm typecheck
pnpm dev   # visit /settings/teams as owner; create → rename → delete; try create when at cap to verify upsell
```

## Risks

- The Main team bootstrap migration must be **idempotent**: re-running it must not create duplicates (use `findOneAndUpdate` + `upsert: true` keyed on `{workspaceId, name: "Main"}`).
- `deleteTeamAction` must refuse to delete the Main team. Guard with `isDefault: true`.
- Plan downgrade guard belongs here (so it's enforced as soon as the team-count cap exists), but the user-facing block-modal lives in Phase 3 where the rest of the Teams UI is built.
