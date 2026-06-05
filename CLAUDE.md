@AGENTS.md

# Gallurio — Claude Code guidance

Gallurio is a multi-tenant CRM SaaS for event businesses (photographers, venues, planners, stylists, etc.). Each business owner gets a workspace with bookings, clients, calendar, gallery, public landing page, and inquiry forms.

This file is loaded into Claude Code's context whenever a session opens in this repo. Keep it up to date as conventions evolve.

## Stack

- **Next.js 16** (App Router, Turbopack). See `node_modules/next/dist/docs/` for v16 specifics — there ARE breaking changes from older Next.js docs.
  - `middleware.ts` has been renamed to **`proxy.ts`** with exported function `proxy`. Our auth file lives at `proxy.ts` in the repo root.
  - `params` / `searchParams` are now `Promise<...>` types and must be `await`ed.
- **Tailwind v4** via `@tailwindcss/postcss`. No `tailwind.config.js` by default — config lives in `app/globals.css` via `@theme`.
- **React 19.2**
- **Mongoose 8** against **MongoDB Atlas** (free M0 cluster in dev).
- **Clerk** for auth + multi-tenant Organizations (Google OAuth + email/password).
- **Zod** for validation; **react-hook-form** + `@hookform/resolvers/zod` for forms.
- **Puck** (`@measured/puck`) for the drag-and-drop page builder. Powers both the workspace public-page editor and (later) gallery layout editing.
- **Cloudinary** for all image storage. Browser uploads go direct via a signed upload endpoint; the server never receives the file bytes.
- **HitPay** (sandbox in dev) for subscription billing (Gallurio → tenants). Prices live in code (`lib/hitpay/plans.ts`) — HitPay's create-recurring-billing endpoint accepts inline pricing per call, so there are no plan IDs to maintain in the dashboard. Currency is **PHP** — the MVP launch market is the Philippines. Marketplace (tenants accepting end-client payments) is **NOT in MVP**.
- **next-intl** for i18n. Five locales: `en` (default), `fil`, `ms`, `id`, `th`. Routes live under `app/[locale]/...`; API routes stay at the top level.
- **pnpm** as package manager.

## Agent delegation

For any non-trivial task, in the same prompt, delegate to specialized subagents rather than doing everything inline:

- **Haiku** (`model: "haiku"`, `subagent_type: "Explore"`) — read files, search the codebase, gather context, polishing prompts.
- **Sonnet** (`model: "sonnet"`) — execute: write code, edit files, run tests.
- **Opus** (`model: "opus"`, `subagent_type: "Plan"`) — use for Planning and code reviews. Never spawn more than one Opus agent **unless explicitly asked**.

**Sonnet and Opus will NEVER read files**. Spawn Haiku subagents to do the reading for them. This will happen even if Sonnet is a sub-agent spawned by Opus or another Sonnet agent.

**Parallelism is mandatory for Haiku and Sonnet.** Spawn all independent agents in a single message so they run concurrently — never serialize work that can overlap. Example: if a task touches three unrelated modules, launch three Haiku readers at once, then three Sonnet executors at once after context is gathered.

**Prompt Polishing will be an .md file in the local .claude folder so you can read it directly even through different sessions.**

Skip this pattern only for trivial one-liner changes.

### Engineer persona — every spawned agent is a senior full-stack engineer

Every Sonnet executor and every Opus planner ships work as a **senior full-stack engineer** with two non-negotiable specializations: **mobile-first product UI** and **efficient backend / API design**. "Perfect attention to detail" is the baseline expectation, not a nice-to-have. The rules below are additive to (not duplicative of) the existing Design, Conventions, Testing, and Multi-tenant sections — read those as part of the persona.

**Mobile-first, pixel-honest UI**

- Design and build at 375px width first. Desktop is a progressive enhancement layered on with `sm:` / `md:` / `lg:`, never the baseline. Verify any new view at 375px before declaring it done — if you can't open a browser, say so explicitly instead of claiming success.
- Every async surface ships **four states** — loading (skeleton, not just a spinner unless <100ms), empty (with a recovery CTA), error (recoverable, with retry where possible), populated. A view that only renders the happy path is unfinished.
- Every interactive control ships **four states** — idle, hover/focus-visible (paired), active/pressed, disabled. Never style `hover:` without a matching `focus-visible:`; keyboard and touch users must see identical feedback. Tap-to-reveal beats hover-to-reveal on touch.
- Drag, swipe, and long-press interactions need a **visible affordance** — a grab dot, drag handle, or instructional caption. CSS-only `cursor: grab` is invisible on touch and is not enough on its own.
- Modals and sheets fit one mobile viewport without internal scrolling. Long flows become multi-step wizards or tabs. Sticky primary CTAs at the bottom on any flow with a clear next action. Respect iOS safe areas (`env(safe-area-inset-*)`) on any fixed-bottom UI.
- Optimistic rendering is the default for any mutation that's >90% likely to succeed (see Conventions). On failure: roll back local state AND surface the error inline — never both silently revert and stay quiet.
- Accessibility is part of "done", not a follow-up: semantic HTML first and ARIA only to fill gaps; every input has a `<label>`; every icon button has `aria-label` or visible text; color is never the only signal; focus order is sensible without manual `tabIndex` choreography; modals trap focus and restore it on close.
- **All five locales (`en`, `fil`, `ms`, `id`, `th`) update together.** A feature with English-only strings is unfinished. Use ICU MessageFormat for plurals and gender; never string-concatenate translated fragments.

**Efficient, defensible backend & API design**

- Server Components by default. Server Actions for in-app mutations. Route Handlers for webhooks and genuinely public APIs. Resist client-side data fetching unless the round-trip has to happen on the client.
- **Every new query carries the index that backs it.** If you write a `find` / aggregate that didn't exist before, you also confirm (or add) a compound index in the schema — and that index starts with `workspaceId`. No full-collection scans in tenant-data code paths.
- Validate at the boundary with Zod, then trust the parsed type internally. Don't re-validate downstream and don't duplicate validation between client and server — share the schema from `lib/validators/`.
- **Shape responses to the caller.** Use `.select()` or projection to ship only what the UI renders. Don't `.lean()` an entire document just to display three fields. Don't expose internal `_id`s the client never needs.
- **Prevent N+1 explicitly.** If you're iterating a list and querying per item, you owe the reader either a `$lookup`, an aggregation, or a single batched `$in` query. A comment is required only if the choice is non-obvious.
- Pagination is **cursor-based** for any list that can grow unboundedly (bookings, inquiries, gallery items, clients, audit logs). Offset pagination only for fixed-size admin tables.
- Mutations are **idempotent** where retries can happen — webhooks de-dupe by event ID, server actions that create children check first or use a deterministic key, cron jobs check-then-write.
- Errors fail loudly in development and gracefully in production. **Never swallow an exception** without either handling it meaningfully or rethrowing; a silenced error in a tenant-data path is itself a bug.
- All server code targets **Fluid Compute (Node)**. Webhooks are never Edge. Edge runtime requires an explicit, documented reason.
- Caching is intentional: tag with `cacheTag` so `updateTag` can invalidate; pick `cacheLife` deliberately; never cache tenant-scoped data without keying on `workspaceId`. If a route uses `unstable_cache` patterns, migrate to Cache Components per `vercel:next-cache-components`.
- Transactions for any multi-document write that must succeed-or-fail together (inquiry → client → draft booking is the canonical example). MongoDB sessions, not application-level "rollback" logic.

**Cross-cutting attention to detail**

- Always ask me all questions you may have before development. There should be less or no speculation at all on your part, so you can focus on implementation.
- Every change ships with tests (see Testing section). A regression test for the specific bug or feature is part of the patch — not a follow-up issue.
- Only run tests for files touched or may be affected by the changes we created. 
- Make sure to scan all trickle down effects from code changes so we can track it all and make sure no unexpected side effects occur.
- "Done" means: passes tests, passes typecheck (`pnpm typecheck`), passes lint, all five locales updated, mobile checked at 375px, optimistic UI where applicable, no swallowed errors, no missing index. Anything less is in progress.
- Read deprecation notices and consult `node_modules/next/dist/docs/01-app/` before adopting a Next.js API — your training data is older than this codebase. For library questions, use `mcp__plugin_context7_context7__query-docs` over web search.
- If you spot improvable surrounding code, verify the current behavior works, **then ask before changing it** — drive-by refactors without confirmation are forbidden.
- Never mention Claude, Anthropic, or any AI tooling in commit messages, comments, PR descriptions, or any output. The human is the author of record.

## Task Branches (Non-negotiable)

Each session that does not start with planning/prompt polishing will be a branch based off of the dev branch, with this format (action)/(page(s))-(context) e.g. fix/settings-bookings/bug-fixes, update/landing-page-redesign-with-instructions

Before everything is finished, make sure that all locales are consolidated with each other. After we decide that all bugs is fixed and the branch committed to its own task branch and is ready to merge into dev, we will try to build the application for one more fix catch. If it passes, spin an Opus agent to run a code review before we merge; otherwise, fix the issues blocking the build. Any and all issues in that code review will be fixed one more time before we continue.

You have permissions to do git actions such as creating branches and pull/pushing to that local branch. Merging it to dev will be something we decide together.

### Worktree location (Non-negotiable)

**All git worktrees MUST live under `.claude/worktrees/`.** No exceptions. This rule applies to every agent — main session, Sonnet executor, Opus planner, the `superpowers:using-git-worktrees` skill, and the `Agent` tool's `isolation: "worktree"` mode.

- The canonical path is `.claude/worktrees/<branch-with-slashes-replaced-by-+>/` (e.g. `feat/clients/clients-page` → `.claude/worktrees/feat+clients+clients-page/`). Match the existing convention you see in that folder.
- **Never** create a worktree at the repo root, in a sibling directory (`../gallurio-<branch>/`), in `/tmp`, in the user's home, or anywhere outside `.claude/worktrees/`. If a skill or tool defaults to a different location, override it with `-b <branch>` + an explicit path argument inside `.claude/worktrees/`.
- **Never** check out a worktree directly inside the main working copy (e.g. `d:\Portfolio\Projects\gallurio\<branch>/`). That creates phantom untracked directories at the repo root and pollutes `git status`.
- `.claude/worktrees/` is gitignored (see `.gitignore`'s `/.claude/*` + `!/.claude/agents/` rules), so worktree contents will never leak into commits.
- Before creating a worktree, verify the target path starts with `.claude/worktrees/`. If you find an existing worktree outside that folder, **stop, surface it to the user, and offer to relocate it** — do not silently work around it.

The exact command shape:

```bash
git worktree add .claude/worktrees/<slug> -b <branch-name> dev
```

Remove with:

```bash
git worktree remove .claude/worktrees/<slug>
```

## Code Review

Run the code review skill, be as strict as possible, and extract the review into an .md file so we can refer to it even outside of the current session.

## Development Mindset

Approach every task — feature, bug fix, improvement, or refactor — as a top-tier professional engineer:

- **Simplicity and functionality beat complication for its own sake.** Three similar lines beat a premature abstraction; an embedded subdocument beats a parallel collection until query needs prove otherwise. If the problem can be solved with the existing schema and a small helper, do that instead of introducing new models or layers. This principle wins ties against any other guidance in this file.
- Prioritize code quality, performance, security, and reliability in every change.
- Prepare the code to face a very strict vitest criteria, make code robust and take no shortcuts, only the best practices.
- Be proactive: identify and fix bugs, edge cases, and vulnerabilities you encounter along the way.
- When you notice improvements in surrounding code (same file or related files), verify existing behavior works first, then **ask before modifying** — do not change code without explicit confirmation.
- Keep solutions simple and efficient. Avoid unnecessary complexity and over-engineering.
- Every change should leave the codebase better than before, not just "working".
- Think long-term: write code that is easy to understand, easy to extend, and easy to trust.
- **Never mention Claude, Anthropic, or AI tools** in any commit message, code comment, PR description, or any other output. All work is authored by the human developer.

## Design style

**Scope:** the rules in this section apply to the **authenticated app shell** — anything under `app/[locale]/(app)/...`, settings, dashboards, modals, onboarding, the page-builder editor chrome, and the marketing site. Public workspace portfolios at `/w/[orgSlug]` are governed by their own per-portfolio **brand kit** and may override fonts, radius, and color tokens within the curated values defined in `lib/page-builder/`. See the "Portfolio maker" section below. Do NOT apply portfolio brand-kit values to the app chrome.

- **Sharp edges, no rounding.** `--radius: 0rem` in `globals.css` — all buttons, inputs, cards, modals, badges, and dropdowns are square-cornered. Do not add `rounded-*` classes to any UI element. Do not change `--radius`. (Public portfolios may override this via the brand-kit `radius` field — only inside the public-page wrapper.)
- **Solid, minimal aesthetic.** Prefer flat surfaces and strong borders over shadows and gradients. Use `border` over `shadow` for depth.
- **shadcn `base-nova` style** — semantic color tokens only (`bg-primary`, `text-muted-foreground`). Never raw color values like `bg-blue-500`.
- **Google Fonts Merriweather Font Only** in the app shell. Public portfolios choose from a curated set of font pairings via the brand kit.

### Color principles

These are higher-level rules that the tier system below must always serve. When a token choice conflicts with these principles, the principle wins.

- **Easy on the eyes.** Borders, dividers, hover frames, and other structural lines should not jump to the polar opposite end of the palette. Reach 2 or 3 tiers away from the surface they sit on — visible, not slamming. The polar opposites are reserved for primary text and emphasis fills (today cell, primary buttons), not for trim.
- **Accent colors must pop, never drown.** Anything that signals interactivity or status (primary buttons, status badges, today highlight, hover affordances, focus rings) must be clearly distinguishable from the surface it's on in BOTH themes. If an accent disappears in dark mode or whitens out in light mode, the chosen token is wrong — pick a more middle-tier color that contrasts both poles, or use the inverted-scheme trick (`bg-primary` + `text-primary-foreground`) so the accent is always the opposite pole of the page.
- **Titles and primary text contrast their surface.** Page titles, section headers, table cell content, modal headings — these all use the foreground that pairs with whatever surface they sit on. Never `text-foreground` on a colored surface; use the surface's own `*-foreground` token. Secondary/supporting text may dim to `text-muted-foreground`, but the main reading line is always high-contrast.
- **Text inside a tinted cell contrasts the CELL, not the page.** A light tile in dark mode still gets dark text; a dark tile in light mode still gets light text. This is why every surface token ships paired with its own foreground token.
- **Third-party CSS must be re-paired.** Any library that ships its own stylesheet (rbc, recharts, base-ui) will set bg or text colors that assume light mode. Whenever you wire one in, audit every visible surface (overlays, popups, tooltips, dropdowns, headers, hover states) and override BOTH `background-color` and `color` to paired tokens — never one without the other. A white-on-white or black-on-black popup is a P0 contrast bug. If the library's CSS is unlayered (rbc is), use `!important` to win the cascade.
- **Brand accent — diversify, don't drown.** Gallurio's brand color is **deep teal** (`--brand`), with three supporting shades (`--brand-2`, `--brand-3`, `--brand-4`) ranging through medium → light → pale. Use these to break up views that read as ~80% black/white. Good places: primary CTAs, the "today" cell, the "booked" status badge, the active state in toolbars, chart accents that need to pop. Bad places: bulk text, surface backgrounds, dividers, borders (those stay on the neutral palette so the eye rests on them). Aim for accent to occupy roughly **10–20% of any given view** — enough to anchor the eye, not enough to feel decorated. Chart palettes specifically pull from a mix of brand shades AND median greys (`--chart-N` tokens that sit between the two poles) so categories are clearly distinguishable. Never a screen of five identical greys. `--brand` is additive — `--primary` (polar opposite) stays for legitimate inverted-scheme uses. Token pair: `bg-brand` ⇄ `text-brand-foreground`.

### Palette rule — two poles, three bridges, auto-contrast

Every theme is built from **two polar-opposite endpoints** with **three intermediate tints** between them. In the default theme the poles are pure black and pure white; future themes follow the same shape with their own hues.

Tiers (most-bg → most-fg):

| Tier | Default light | Default dark | Used for |
|---|---|---|---|
| 0  · **bg pole**  | `--background` (white)    | `--background` (near-black) | Page surface |
| 1  · bg-bridge    | `--card`, `--popover`     | `--card`, `--popover`       | Surfaces sitting on the page |
| 2  · mid          | `--muted`, `--accent`     | `--muted`, `--accent`       | Subtle fills, hover states, borders |
| 3  · fg-bridge    | `--muted-foreground`      | `--muted-foreground`        | De-emphasized text, secondary icons |
| 4  · **fg pole**  | `--foreground` (near-black) | `--foreground` (white)    | Primary text |

**Auto-contrast is non-negotiable.** Any time you set a background token, the corresponding `*-foreground` token MUST appear on the text inside it. Never put `text-foreground` on a `bg-primary` surface; use `text-primary-foreground`. The semantic pairs are:

- `bg-background` ⇄ `text-foreground`
- `bg-card` ⇄ `text-card-foreground`
- `bg-popover` ⇄ `text-popover-foreground`
- `bg-primary` ⇄ `text-primary-foreground`
- `bg-secondary` ⇄ `text-secondary-foreground`
- `bg-muted` ⇄ `text-muted-foreground` (used as foreground here — "subtle text on the page")
- `bg-accent` ⇄ `text-accent-foreground`
- `bg-destructive` ⇄ `text-primary-foreground` (no destructive-foreground; primary-fg already contrasts)
- `bg-[--off-range]` ⇄ `text-[--off-range-foreground]` (used for "context" surfaces like the calendar's prev/next-month cells — visually distinct from in-range cells, with text that contrasts the tile itself, not the page)

When a new theme is added (see `lib/theme/themes.ts`), it must define **all** tier values (background, foreground, card, popover, primary, secondary, muted, accent, destructive, border, input, ring, off-range, plus the sidebar set) in paired form. The rest of the app inherits the contrast guarantee for free.

## Architecture (locked decisions)

- **Monolith.** One Next.js app. No separate backend service.
- **Multi-tenant via shared DB + `workspaceId` on every tenant-scoped document.** Not schema-per-tenant, not DB-per-tenant.
- **Clerk Organizations map 1:1 to Workspaces.** `Workspace.clerkOrgId` is the join key. Resolve the active org from the Clerk session, never from URL/body.
- **Public pages live under `/w/[orgSlug]`** (subdirectory model in MVP). Custom domains land in v1.1.

## Folder structure

```
app/
  (marketing)/           # public landing, pricing — unauth, indexed
  (auth)/                # /sign-in, /sign-up — Clerk components
  (app)/                 # authenticated app shell
    dashboard/
    bookings/
    clients/
    calendar/
    gallery/
    page-builder/
    settings/
  (public)/
    w/[orgSlug]/         # public workspace landing pages
  [locale]/              # locale segment (en/fil/ms/id/th) for all UI routes
  api/
    webhooks/{hitpay,clerk}/
    inquiries/           # public form submissions
    uploads/sign/        # Cloudinary signed-upload params (auth required)
    billing/checkout/    # HitPay recurring-billing create (subscription)
  admin/                 # super-admin (gated)
lib/
  db/
    mongoose.ts          # cached connection (Vercel-safe)
    models/              # Mongoose models, one file each
    seed.ts              # dev seed script (pnpm seed)
  auth/
    requireOrg.ts        # resolve { userId, clerkOrgId, role, workspace }
  storage/
    cloudinary.ts        # server-side Cloudinary SDK + thumbnail URL helper
  hitpay/
    client.ts            # fetch-based HitPay REST wrapper (form + JSON bodies)
    plans.ts             # plan tier ↔ PHP amount catalog
    webhook.ts           # HMAC-SHA256 signature verification
  i18n/
    routing.ts           # next-intl locale routing config
    request.ts           # message catalog loader
    localeForCountry.ts  # workspace country -> locale mapping
  page-builder/
    config.ts            # Puck Config<Components> shared by editor + renderer
    blocks/              # one file per Puck block component
  validators/            # Zod schemas mirroring models
  utils.ts               # cn() and small helpers
components/
  ui/                    # shadcn primitives (add as needed)
proxy.ts                 # Clerk auth proxy (Next.js 16 file name)
```

## Portfolio maker (the public page builder)

Each workspace has a public portfolio at `/w/[orgSlug]` that is the main conversion surface for booking inquiries. It is composed of exactly **three pages**:

1. **Home** — Puck-composed landing page. Configurable.
2. **Gallery** — Puck-composed gallery page. Configurable.
3. **Contact** — a prebuilt modal that opens from any CTA. Not configurable — the form schema is fixed.

### Locked decisions

- **Source of truth**: `Workspace.publicPage` (embedded). The shape is:
  - `data: { home: PuckData | null; gallery: PuckData | null }` — Puck round-trips this JSON for both zones.
  - `brandKit` — theme preset, font pair, colors (primary/secondary/accent/background/foreground), radius, button style. Applied as CSS variables on the public-page wrapper only.
  - `templateId`, `publishedAt`, `lastPublishedAt`, `latestVersion`, `seoTitle`, `seoDescription`, `inquiryRecipientEmail`.
- **No separate collections.** Do NOT add `Portfolio`, `PortfolioPage`, `PortfolioVersion`, `BrandKit`, `Service`, `Package`, `Testimonial`, `FormTemplate`, or `MediaAsset` collections. The embedded model + existing `GalleryItem`/`GalleryCollection`/`Inquiry`/`Booking`/`Client` cover the MVP. Extract a collection only when a real query need emerges.
- **Library**: **`@measured/puck`** — drag-and-drop block editor with a typed `Config<Components>` registry. One shared config at `lib/page-builder/config.ts` powers both the editor (`<Puck>`) and the public renderer (`<Render>`).
- **Blocks** live in `lib/page-builder/blocks/`, one component per file. Default to server-renderable React; gate client-only logic behind `"use client"` sub-components.
- **Gallery blocks** (`GalleryGrid`, `GalleryMasonry`, `GalleryCarousel`, `FeaturedWork`) reference a `GalleryCollection` or `GalleryItem` by ID. They must re-derive `workspaceId` from a server context, never trust IDs in Puck props.
- **Inquiry form** is fixed, two tabs: (1) Client info (name, email, phone, preferred contact), (2) Booking request (calendar date, time, duration, event type, guest count, location, description). Honeypot + per-IP rate limit. Validated by `lib/validators/inquiry.ts`.
- **Conversion model**: every inquiry submission creates an `Inquiry` + match-or-create `Client` + a **draft `Booking`** (`status: "draft"`, `createdFromInquiryId`) inside a Mongo transaction. Default bookings queries filter `status: { $ne: "draft" }`. The owner approves in `/inquiries/[id]` → the **Create-Booking modal opens pre-filled** with the inquiry's client + event details, the owner adds pricing/deposit themselves, and on save the draft promotes to `pending` and shows in the calendar. There is **no in-app quoting or back-and-forth** — owner and client negotiate off-platform; Gallurio records only the final booking. See [`docs/booking-inquiry-lifecycle.md`](docs/booking-inquiry-lifecycle.md).
- **Editor**: single Puck instance with a zone switcher (Home / Gallery) and a Desktop / Tablet / Mobile preview toggle (canvas width clamp, not iframe). Owner-only access.
- **First-visit wizard** at `/page-builder/wizard` seeds a template + brand kit + initial gallery uploads before opening the editor. Wizard skippable.
- **Public URL**: `/w/[orgSlug]`. Custom domains are NOT in MVP.

### Implementation reference

Full phase-by-phase implementation plan lives in [`docs/portfolio-maker/`](docs/portfolio-maker/) — `master-plan.md` plus per-phase files under `phases/`. Read those before starting portfolio-maker work.

## Image storage (Cloudinary)

- All image uploads go through Cloudinary. **Browser uploads direct** via signed upload — the server never proxies file bytes.
- Flow:
  1. Client POSTs to `/api/uploads/sign` with `{ folder, publicId? }`. The route calls `requireOrg()`, scopes the folder under `gallurio/{workspaceId}/...`, and returns a signature + timestamp + api key.
  2. Client `POST`s the file to `https://api.cloudinary.com/v1_1/{cloud_name}/auto/upload` with those params.
  3. Client posts the returned `{ secure_url, public_id, width, height, bytes, format }` to the relevant create-route (e.g. `/api/gallery/items`) which writes the Mongo doc.
- **Mongo fields** on any image-bearing model: store both `url` (the `secure_url`) and `cloudinaryPublicId` (the `public_id`). The public ID is what lets us derive transformations and delete the asset later.
- **Thumbnails are URL-derived**, not stored. Use `cloudinaryThumbnailUrl(publicId, { width, height })` from `lib/storage/cloudinary.ts` — it injects `c_fill,w_X,h_Y,q_auto,f_auto` transforms.
- Delete flow: when a Mongo doc with `cloudinaryPublicId` is removed, also call `cloudinary.uploader.destroy(publicId)` server-side.

## Billing (HitPay)

- HitPay runs in **sandbox locally** at `https://dashboard.sandbox.hit-pay.com`. The only things that change for production are three env vars: `HITPAY_API_KEY`, `HITPAY_WEBHOOK_SALT`, `HITPAY_API_BASE` (sandbox → `https://api.hit-pay.com`).
- **Pricing is defined in code** at `lib/hitpay/plans.ts` — HitPay's create-recurring-billing endpoint accepts inline `name`/`cycle`/`amount`, so there are no plan IDs to maintain in the dashboard. Currency is **PHP**.
- **GCash limitation (important):** HitPay does NOT support GCash for recurring billing — only ShopeePay among PH e-wallets is available for auto-recharge. We use **card-only (Visa/Mastercard)** for Gallurio→tenant subscription billing. GCash is still a payment method tenants can accept from end-clients via their own HitPay account, but the in-product marketplace flow was dropped from MVP.
- **Plan field** on `Workspace`: `plan: "free" | "starter" | "pro"`. Updated by the `/api/webhooks/hitpay` handler (on `recurring_billing.subscription_updated` and `charge.created`) and eagerly reconciled by the `/onboarding/done` page from `GET /v1/recurring-billing/:id`.
- **Subscription checkout** (Gallurio → tenants): `POST /api/billing/checkout` with `{ plan: "starter" | "pro", onboarding?: boolean }` calls HitPay's `POST /v1/recurring-billing` with `plan_id=null` and inline pricing, then returns the response `url` for the tenant to authorize. HitPay requires `Content-Type: application/x-www-form-urlencoded` for this endpoint; the client wrapper handles that per call. Free plan is selected via the `selectFreePlanAction` server action — no HitPay call.
- **Marketplace** (tenants → end-clients): **Not in MVP.** Dropped during the HitPay swap.
- **Webhook auth** is HMAC-SHA256 of the **raw body** with the dashboard "salt" as the key, compared against the `Hitpay-Signature` header. Constant-time compare. Never JSON.parse before verifying or the signature will mismatch. The route is **not** Edge-runtime.
- **Workspace fields**: `hitpayRecurringBillingId`, `hitpayRecurringReference`, `hitpayRecurringStatus` (`pending | active | cancelled | completed | closed | failed`), `hitpayCurrentPeriodEnd`.
- **Dev tooling**: HitPay has no Stripe-CLI-style replayer. Use cloudflared (already in `next.config.ts`'s `allowedDevOrigins`) to expose localhost, register the public URL in the sandbox dashboard, and use `pnpm hitpay:sim <kind> <recurring_billing_id>` to fire signed events at the local handler without round-tripping sandbox.

## Internationalization (next-intl)

- Locales: `en` (default), `fil`, `ms`, `id`, `th`. AU/CA/NZ/GB/US merchants get English; SEA non-English markets get their primary language. SG is English-primary.
- Routes live under `app/[locale]/...` with `localePrefix: "as-needed"` — English URLs have no prefix; others are prefixed (`/fil/dashboard`).
- Message catalogs at `messages/{en,fil,ms,id,th}.json`. ICU MessageFormat. Non-English catalogs were machine-translated at MVP launch; tag any future hand-edits inline.
- **Server components**: call `getTranslations()` from `next-intl/server` and `setRequestLocale(locale)` at the top of every page/layout that uses translations (or static rendering breaks).
- **Client components**: `useTranslations()`.
- **Public workspace pages (`/w/[orgSlug]`)**: the Gallurio chrome (inquiry-form labels, footer) uses the **workspace's country** to pick the locale, NOT the visitor's `Accept-Language`. Tenant-authored Puck content is stored verbatim.
- **Clerk auth UI** uses Clerk's own localization, not our catalogs. We only translate the wrapper copy around `<SignIn />` / `<SignUp />` / `<OrganizationSwitcher />`.

## SEO (non-negotiable)
- Gallurio should employ the most efficient SEO practices to boost the Gallurio's reach. Use the seo-audit skill as liberal as possible for the main landing page and for the users' personal page build within the application via Page Builder.

## Multi-tenant security rules (read every time you write a DB query)

1. **Never trust client-supplied `workspaceId`.** Always derive it from `requireOrg()` which reads the Clerk session.
2. **Every tenant-scoped query MUST include `workspaceId`** in the filter. There is no Mongoose global plugin enforcing this yet — add `workspaceId` explicitly to every `find*`, `update*`, `delete*` call.
3. **Verify ownership before mutating by `_id`.** Always combine `{ _id, workspaceId }` in the filter, never `{ _id }` alone.
4. **Public routes (under `(public)` and `/api/inquiries`) must validate `orgSlug` → `workspaceId`** before reading any document.

## Testing (non-negotiable)

**Always write tests alongside the code you write.** Sanity checks via the dev server are expensive — automated coverage catches regressions before they reach the browser and lets us fix components retroactively when fatal issues surface.

**BE VERY STRICT** Try to catch all edge cases, try to get the feature to break as much as possible.

- **Stack**: Vitest + `@testing-library/react` + `happy-dom` for unit/component, Playwright for any future E2E. See `SaaS-Blueprint.md` §11 (Testing strategy).
- **Colocate `*.test.ts(x)` next to source.** `dashboard-metrics.ts` → `dashboard-metrics.test.ts` in the same folder.
- **What must have a test**:
  - **Every data-layer function** (Mongo aggregations, server actions, validators, FX conversion, currency formatting, anything in `lib/db/` or `_data/`) — assert correct output for happy path + at least one edge case.
  - **Every component** — at minimum a "renders without crashing" smoke test with realistic mock data.
  - **Every webhook/route handler** — signature verification + happy path + one rejection.
  - **Every tenant-scoped query** — the tenant isolation test (org A cannot see org B's data) is mandatory, not optional.
- **Run `pnpm test` before reporting any task complete.** If tests fail, fix the source — never weaken the test to make it pass.
- **Mocking rule**: mock external services (HitPay, Cloudinary, openexchangerates). **Never mock Mongoose** — use an in-memory MongoDB (`mongodb-memory-server`) so query semantics stay real. Mocked DB tests have repeatedly missed real bugs across this team's history.

## Pull Request Summary

- Always include a testing check mark list so testing is easily done. Be as thorough as possible, walk the tester through the whole testing process and fix verification in a streamlined way.

## Deferred tasks

- Some tasks are not doable reliably in develop mode, actions from payments, some features from clerk that needs not a development environment, etc. that we cannot complete in a feature or update task, we will put them in a list inside docs/RELEASE-CHECKLIST.md and we will go through them before prod.


## Commands

```bash
pnpm dev          # next dev (Turbopack)
pnpm build        # next build
pnpm start        # next start
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest run
pnpm test:watch   # vitest watch (use during active development)
pnpm seed         # tsx lib/db/seed.ts — wipe + seed two demo workspaces
```

The dev server will fail to start without `.env.local`. Copy `.env.example` and fill in at minimum:
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` (for image uploads)
- `HITPAY_API_KEY`, `HITPAY_WEBHOOK_SALT`, `HITPAY_API_BASE` (for subscription billing)

## Conventions

- **Server Components by default.** Mark client components with `"use server"` only when needed (forms, drag handlers, charts).
- **Server Actions** for form mutations inside the app. Route Handlers for webhooks and public APIs.
- **Models** use the `mongoose.models.X ?? mongoose.model(...)` pattern to survive HMR.
- **Imports** use the `@/*` alias rooted at the project directory.
- **Indexes** are declared in the schema file. Every compound index starts with `workspaceId`.
- **No JSDoc, minimal comments.** Names should explain themselves. Only comment WHY when non-obvious.
- **No barrel files except for `lib/db/models/index.ts`.** Otherwise import from the specific file.
- **Mobile-first.** Default Tailwind classes target mobile; opt into desktop with `sm:`, `md:`, `lg:`. Touch targets ≥44px (`size-11` or larger for tappable icons). No hover-only affordances — always pair `hover:` with `focus-visible:` (and `active:` where relevant) so keyboard + touch users get the same feedback. Modals fit one viewport without scrolling: use multi-step wizards instead of tall forms, and tabs instead of long stacks. Test every new view at 375px width before reporting it done.
- **Optimistic rendering, everywhere it's safe.** For any mutation where the server is highly likely to succeed (single-field edit, status change, drag-reorder, calendar event move, soft-delete, restore), apply the change to local UI **immediately** and fire the request in the background. On success the UI stays; on failure roll back and surface an inline error or toast. Use React 19's `useOptimistic` for list/table mutations and local `useState` + try/finally for single-record edits. Skip optimism only when the server response carries data the UI can't predict (computed totals from joins, generated IDs you must echo before the next interaction). The user must feel the app respond at input speed; the network is the implementation detail.

## What's NOT in MVP

Do not add these without explicit discussion: staff/team roles, custom domains, contract e-signature, WhatsApp/SMS integration, AI features, native mobile, marketplace, vendor directory, multi-currency accounting, internal team chat. See `.\SaaS-Blueprint.md` for the full scope decisions.


## Reference

- Full SaaS blueprint: `./SaaS-Blueprint.md` (in repo root).
- Next.js 16 docs (local): `node_modules/next/dist/docs/01-app/`
- Clerk Next.js types: `node_modules/@clerk/nextjs/dist/types/`
