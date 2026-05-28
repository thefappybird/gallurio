# Teams Management — Roadmap Index

**Branch:** `feat/teams/management` (worktree at `.claude/worktrees/feat+teams+management`, based off `dev`)
**Status:** planning complete · Phase 1 in progress

Each phase is a separately mergeable PR. Open the phase you're working on; the README only carries shared context (decisions, architecture).

## Phases

| # | File | Status | Summary |
|---|---|---|---|
| 1 | [phase-1-permissions-foundation.md](./phase-1-permissions-foundation.md) | in progress | Plan entitlements + pure `planEntitlements()` helper. No UI, no models. |
| 2 | [phase-2-team-model-and-settings.md](./phase-2-team-model-and-settings.md) | not started | `Team` + `TeamMembership` models, owner Teams settings panel, Main-team bootstrap, `assertCanAddTeam` guard. |
| 3 | [phase-3-member-invites-and-nav.md](./phase-3-member-invites-and-nav.md) | not started | Clerk-based invites, team assignment UI, `assertCanAddTeamMember` guard, reduced member sidebar. |
| 4 | [phase-4-booking-team-linkage.md](./phase-4-booking-team-linkage.md) | not started | `Booking.teamId`, backfill migration, member-visibility query layer, `canEditBooking`. |
| 5 | [phase-5-calendar-team-scoping.md](./phase-5-calendar-team-scoping.md) | not started | Team picker in calendar toolbar; color-coded overlay; auto-fill `teamId` from active calendar. |
| 6 | [phase-6-transactions-team-attribution.md](./phase-6-transactions-team-attribution.md) | not started | Denormalize `teamId` onto Transaction; team column in transactions UI. |

---

## Context

Gallurio is single-user today: one Clerk user = one Workspace = one calendar. Owners running real event businesses (photo studios, planner duos, small venues) need to bring teammates into the product so multiple people can work bookings in parallel without all sharing the owner's login. This roadmap adds **Teams** — a way for an owner to invite teammates, group them into teams that each have their own calendar, and have every booking carry which team is working it.

**MVP scope intentionally locked out**: hiring/marketplace (member self-signup looking for teams), per-team chat, time-off/availability, payroll, custom permission bits beyond the three roles below.

---

## Locked decisions

| # | Decision | Value |
|---|---|---|
| 1 | Plan gating model | Teams are **universal** — every plan gets at least one team. What scales by plan is the **team count cap**. |
| 2 | Team count caps (Main team counts toward the cap) | Free **1** · Starter **3** · Pro **15** |
| 3 | Per-team membership cap | **10 people per team**, applied independently. A user in Teams A and B consumes one slot in each. |
| 4 | Effective max members per workspace | Free **10** · Starter **30** · Pro **150** (theoretical; per-team 10 cap × team count) |
| 5 | Backfill on workspace creation / first run | Auto-create a "Main" team in **every** workspace (Free included) and assign all existing bookings to it |
| 6 | Role model | **owner** (workspace-wide) + **member** (workspace-wide) + **lead** (per-team flag on a member) |
| 7 | Lead powers (within their team only) | Edit teammates' bookings · Create bookings · View transactions/payments tied to their team's bookings |
| 8 | Member powers (non-lead, within their team) | View all team bookings · Edit only bookings where their userId is in `staffIds` |
| 9 | Invite mechanism | Clerk org invitations; team assignment happens in Gallurio UI after the invite is accepted |
| 10 | Member sidebar | Bookings + Calendar only. No Dashboard/Clients/Inquiries/Gallery/Settings |
| 11 | Member calendar default | All their teams overlaid + color-coded; switcher to filter to one team |
| 12 | Free-tier Teams UX | **Fully functional within the 1-team + 10-member caps.** Upsell appears only when the owner clicks "Create new team" and would exceed the cap → CTA pointing at `/pricing#teams` |
| 13 | Downgrade with too many teams | **Block** the downgrade; modal lists teams to delete (and bookings to reassign) before the plan change can complete |
| 14 | `Booking.staffIds[]` interaction | Keep both. `teamId` = visibility/ownership of the booking. `staffIds` = which specific members are working it (used for the "edit own only" rule) |

**Open items deferred** (note, don't block):
- Whether Starter/Pro pricing should be re-tuned now that Free is more capable (10-person Free tier may cannibalize Starter). Defer until after Phase 3 ships and we see real-world adoption.
- Whether to add per-member working-hours / availability — out of MVP; deferred.
- Whether to add a separate "workspace member" cap distinct from team-seat math — deferred; per-team cap is sufficient for MVP.

---

## Architecture summary

- **Workspace ↔ Clerk Org** is already 1:1 via `Workspace.clerkOrgId` ([lib/db/models/Workspace.ts](../../../../lib/db/models/Workspace.ts)). No change.
- **Per-user membership** already lives at `User.memberships[]` with `{workspaceId, role: "owner" | "staff"}` ([lib/db/models/User.ts](../../../../lib/db/models/User.ts)), kept in sync by the [Clerk webhook](../../../../app/api/webhooks/clerk/route.ts). We will treat the existing `"staff"` role as **"member"** in new code, and rename eventually (kept compatible via a small helper, not a schema rename, to avoid a risky data migration).
- **`requireOrg()` already returns `role`** ([lib/auth/requireOrg.ts](../../../../lib/auth/requireOrg.ts)) — we layer new helpers on top, never replace it.
- **Settings already supports owner-only subtabs** via the `<CustomPage>` + `OWNER_ONLY_SLUGS` pattern ([app/[locale]/(app)/settings/[[...catchall]]/page.tsx](../../../../app/[locale]/(app)/settings/[[...catchall]]/page.tsx)). Teams panel slots in here.
- **Booking has `staffIds[]` already** ([lib/db/models/booking.ts](../../../../lib/db/models/booking.ts)). We add `teamId` alongside it (decision 14).
- **No `invite*` anywhere** in the repo. Phase 3 wires Clerk's `clerkClient.organizations.createOrganizationInvitation`.

---

## Cross-cutting verification (run before any phase merges)

```bash
pnpm typecheck
pnpm lint
pnpm test            # full suite ONLY on pre-merge sweep; per-feature use --run <fragment>
pnpm build           # catches Next.js 16 / Turbopack edge cases
```

Per CLAUDE.md: after the branch is ready and green, run a strict Opus code review before merging to `dev`. Tenant-isolation tests are mandatory for any new query or model.

---

## Suggested cadence

1. **Phase 1** — fast, ~half day. Ship, merge, breathe.
2. **Phase 2** — 1–2 days. Model + CRUD + settings panel + per-team cap guard + Main-team bootstrap.
3. **Phase 3** — 2–3 days. Clerk webhook coordination + per-team member-cap guard + member-nav stripping. Sit with this one.
4. **Phase 4** — 1–2 days. Migration is the scary part — dry-run twice on a prod snapshot.
5. **Phase 5** — 1–2 days. UI-heavy. Use the optimistic-rendering rule from CLAUDE.md.
6. **Phase 6** — half day. Largely an additive column + a small migration.

Total: ~1.5 weeks of focused work.
