# Gallurio docs — start here

One page to orient an agent before touching this codebase. Read `CLAUDE.md` (root) first — it's the binding instruction set (working style, coding principles, tenancy rules, git/testing/review workflow). This file is a map of everything else.

## Module reference (architecture + data model, one file per area)

| Module | File | Covers |
|---|---|---|
| Billing | `docs/modules/billing.md` | Lemon Squeezy checkout/webhook architecture, beta program lifecycle + ops commands, promo codes, provider-decision constraints |
| Auth & tenancy | `docs/modules/auth-tenancy.md` | WorkOS AuthKit identity, workspace/membership model, active-workspace cookie, env setup |
| i18n & design | `docs/modules/i18n-design.md` | Locales, Arabic/RTL rollout status, design tokens ("The Studio Ledger") |
| Portfolio & media | `docs/modules/portfolio-and-media.md` | Public portfolio data model, Cloudflare Images pipeline |
| Hosting & ops | `docs/modules/hosting-ops.md` | Production deploy shape, scheduled jobs, endpoint-hardening checklist |
| Core CRM domain | `docs/modules/core-domain.md` | Bookings/clients/teams/notifications data model, legal page copy source |

Each module doc is a summary, not the deep-dive — where a `.claude/skills/*` entry exists for the same area (portfolio builder, billing, emails, notifications, calendar), the module doc says so and defers the operational detail to that skill.

## Skills (deep operational reference, invoke via the Skill tool)

Portfolio builder: `portfolio-editor-architecture` (start here, routes to the rest), `portfolio-blocks-and-design`, `portfolio-drafts`, `portfolio-theme-brand-kit`, `portfolio-guide`, `portfolio-effective-defaults`, `portfolio-testing`.
Other domains: `lemonsqueezy-dev` (billing/checkout local testing), `emails`, `notifications`, `calendar-management`, `optimistic-rendering`.

## Living reference docs (not folded into module docs — read directly)

- `docs/RELEASE-CHECKLIST.md` — the beta→production launch gate; current pending/done status.
- `docs/backend-audit-findings.md` — known endpoint-hardening lapses and their status.
- `REUSABLE_CODE.md` (root) — shared component/hook/helper catalog; check before writing new shared code.
- `PRODUCT.md` / `DESIGN.md` (root) — product register and design-token source of truth for any UI work.
- `SaaS-Blueprint.md` (root) — original product blueprint.
- `AGENTS.md` (root) — release-stage behavioral rules (stack, security/tenancy, billing provider stance, git workflow) for agents working on this branch specifically.

## Conventions

- Branch from `dev`; worktrees only under `.claude/worktrees/`.
- Never delete: `README.md`, a master-plan doc, a product-spec-reference doc, a blueprint doc, `docs/backend-audit-findings.md`, `docs/RELEASE-CHECKLIST.md`, `REUSABLE_CODE.md`.
- Scratch docs (one-off specs/plans/reviews) get consolidated into the relevant module doc above and deleted once their feature ships — don't let them accumulate. See CLAUDE.md's Docs hygiene section.
