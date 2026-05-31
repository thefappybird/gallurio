# Teams Management — Roadmap Index

**Status:** Phases 1–4 shipped · Phases 5–6 planned

Each phase is a separately mergeable PR. Open the phase you're working on; the README only carries shared context (decisions, architecture).

> **Read first:** [phases-1-3-as-built-notes.md](./phases-1-3-as-built-notes.md) — the shipped
> system diverged from the original 1–3 plan docs (dedicated `/teams` page instead of a Settings
> panel; member nav + `proxy.ts` guards already done; Main-team bootstrap done). The phase-1/2/3
> files below remain as historical planning records; trust the as-built notes where they conflict.

## Phases

| # | File | Status | Summary |
|---|---|---|---|
| 1 | [phase-1-permissions-foundation.md](./phase-1-permissions-foundation.md) | ✅ shipped | Plan entitlements + pure `planEntitlements()` helper. |
| 2 | [phase-2-team-model-and-settings.md](./phase-2-team-model-and-settings.md) | ✅ shipped (as dedicated `/teams` page, not a Settings panel) | `Team` + `TeamMembership` models, owner Teams page, Main-team bootstrap, `assertCanAddTeam` guard. |
| 3 | [phase-3-member-invites-and-nav.md](./phase-3-member-invites-and-nav.md) | ✅ shipped | Clerk invites, team assignment UI, `assertCanAddTeamMember`, reduced member sidebar (`MEMBER_NAV = [Bookings]`) + `proxy.ts` guards. |
| 4 | [phase-4-booking-team-linkage.md](./phase-4-booking-team-linkage.md) | ✅ shipped | Team **soft-delete** (deactivate/reactivate), `Booking.teamId` + backfill, member-visibility scoping across the booking API, `canEditBooking`. |
| 5 | [phase-5-calendar-team-scoping.md](./phase-5-calendar-team-scoping.md) | planned | Team picker; team-color overlay on "All teams"; auto-fill `teamId`; lead/member create UX. |
| 6 | [phase-6-transactions-team-attribution.md](./phase-6-transactions-team-attribution.md) | planned | Denormalize `teamId` onto Transaction; surface team in client-detail list + dashboard grouping. |
| — | [phases-1-3-as-built-notes.md](./phases-1-3-as-built-notes.md) | reference | Divergence table: what actually shipped in 1–3. |

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
| 14 | `Booking.staffIds[]` interaction | Keep both. `teamId` = visibility/ownership of the booking. `staffIds` = reserved for a future member-edit hook (unused in MVP — members are view-only) |
| 15 | Team removal (Phase 4) | Teams are **soft-deleted (deactivated), never hard-deleted** once bookings/transactions reference them. Deactivated teams: hidden by default (Show-deactivated toggle + `[Inactive]` pill), excluded from the active-team cap, not assignable to new bookings, still resolvable for display. The Main/default team can never be deactivated. Replaces the Phase 2/3 `deleteTeamAction`. |
| 16 | Member booking access (Phase 4) | **View-only in MVP.** Owners + team leads create/edit; plain members only view their teams' bookings. Enforced server-side across the whole booking API (`canEditBooking` / `canWriteBookingForTeam` / `resolveBookingTeamScope`). |

**Open items deferred** (note, don't block):
- Whether Starter/Pro pricing should be re-tuned now that Free is more capable (10-person Free tier may cannibalize Starter). Defer until after Phase 3 ships and we see real-world adoption.
- Whether to add per-member working-hours / availability — out of MVP; deferred.
- Whether to add a separate "workspace member" cap distinct from team-seat math — deferred; per-team cap is sufficient for MVP.

---

## Architecture summary

- **Workspace ↔ Clerk Org** is already 1:1 via `Workspace.clerkOrgId` ([lib/db/models/Workspace.ts](../../../../lib/db/models/Workspace.ts)). No change.
- **Per-user membership** already lives at `User.memberships[]` with `{workspaceId, role: "owner" | "staff"}` ([lib/db/models/User.ts](../../../../lib/db/models/User.ts)), kept in sync by the [Clerk webhook](../../../../app/api/webhooks/clerk/route.ts). We will treat the existing `"staff"` role as **"member"** in new code, and rename eventually (kept compatible via a small helper, not a schema rename, to avoid a risky data migration).
- **`requireOrg()` already returns `role`** ([lib/auth/requireOrg.ts](../../../../lib/auth/requireOrg.ts)) — we layer new helpers on top, never replace it.
- **Teams shipped as a dedicated top-level page** at `app/[locale]/(app)/teams/` with its own `OWNER_NAV` item — **not** a Settings CustomPage as originally planned. See the as-built notes.
- **Booking has `staffIds[]` already** ([lib/db/models/Booking.ts](../../../../lib/db/models/Booking.ts)) and now carries `teamId` (Phase 4). `teamId` = visibility/ownership; `staffIds` stays unused, reserved for a future member-edit hook (decision 14).
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
