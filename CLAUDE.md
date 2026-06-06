# Gallurio

Gallurio is a multi-tenant CRM SaaS for event businesses. Each workspace has bookings, clients, calendar, gallery, public pages, and inquiry forms.

## Stack
- Next.js 16 App Router + Turbopack
- React 19.2
- Tailwind v4
- Mongoose 8 + MongoDB Atlas
- Clerk auth + Organizations
- Zod
- react-hook-form
- Puck
- Cloudinary
- Paddle
- Vercel Workflow DevKit (`workflow`, `@workflow/next`) for durable subscription checkout
- next-intl
- pnpm
- RTK (`rtk-ai/rtk`) for token-efficient command and prompt compression

## Framework rules
- Next.js 16 only: use local docs when unsure
- `middleware.ts` is `proxy.ts` and exports `proxy`
- `params` and `searchParams` are async and must be awaited
- Prefer current repo/library docs over model memory

## Working style
- Keep prompts, commands, and outputs compact, high-signal, and non-repetitive
- Use RTK when it reduces tokens without changing required semantics
- Simplicity beats abstraction
- Fix the task directly; do not over-engineer
- If nearby code can be improved, verify current behavior first, then ask before changing it
- Never mention AI tools in code, commits, PRs, comments, or output

## RTK command policy
- Prefer explicit RTK commands for verbose shell output
- Use:
  - `rtk read`, `rtk grep`, `rtk find`, `rtk ls`
  - `rtk git status`, `rtk git diff`, `rtk git log`, `rtk git add`, `rtk git commit`, `rtk git push`, `rtk git pull`
  - `rtk vitest`, `rtk test <cmd>`, `rtk err <cmd>`
  - `rtk lint`, `rtk tsc`, `rtk next build`
- Prefer explicit RTK commands over automatic rewrite
- On Windows outside WSL, do not assume auto-rewrite works; call RTK directly
- Avoid relying on RTK rewrites for `pnpm <script>` when filters, env vars, script flags, or exact script behavior matter
- Fall back to native commands when exact raw output, patch compatibility, piping, or full uncompressed diffs/logs are required
- Prefer:
  - `rtk vitest` over `pnpm test`
  - `rtk lint` over `pnpm lint`
  - `rtk tsc` over `pnpm typecheck`
  - `rtk next build` over `pnpm build`
  when summarized output is sufficient

## Agent delegation
- Use delegation for non-trivial work
- Haiku: read files, search codebase, gather context, polish prompts
- Sonnet: implementation
- Opus Medium: planning and code review only
- Sonnet and Opus do not read files directly; use Mini readers for context
- Run independent Mini readers in parallel
- Skip delegation only for trivial one-liners
- Prompt polishing lives in `.claude/`
- Never use Sonnet with 1M context.

## Engineering bar
Every executor/planner operates as a senior full-stack engineer with strong mobile-first UI and backend/API design judgment.

### UI
- Design mobile-first at 375px
- Every async surface ships loading, empty, error, and populated states
- Every interactive control ships idle, hover/focus-visible, active, and disabled states
- No hover-only UX
- Drag interactions need visible affordances
- Large mobile flows should use steps/tabs, not tall scroll-heavy modals
- Accessibility is required: semantic HTML, labels, keyboard support, focus management, color not sole signal
- Update all 5 locales together: `en`, `fil`, `ms`, `id`, `th`
- Prefer optimistic UI for high-confidence mutations

### Backend
- Server Components by default
- Server Actions for in-app mutations
- Route Handlers for webhooks/public APIs
- Validate at boundaries with Zod, then trust parsed types
- Shape responses to caller needs
- Prevent N+1 queries
- Use cursor pagination for unbounded lists
- Make retry-prone mutations idempotent
- Never swallow errors
- Use Node runtime unless Edge is explicitly justified
- Cache intentionally
- Use Mongo transactions for multi-document writes that must succeed together

## Multi-tenant rules
- Never trust client-supplied `workspaceId`
- Resolve tenant scope from Clerk session/org
- Every tenant-scoped query must include `workspaceId`
- Every mutation by `_id` must also filter by `workspaceId`
- Public routes must resolve `orgSlug -> workspaceId` before reading tenant data
- Every new compound index starts with `workspaceId`

## Design rules
- App shell is sharp-cornered only; no `rounded-*`
- Prefer flat UI and borders over shadows/gradients
- Use semantic tokens only, never raw color utility values
- App shell uses Merriweather only
- Public portfolios may override brand styling only inside the public page wrapper

## Architecture
- Monolith Next.js app
- Shared DB multi-tenancy via `workspaceId`
- Clerk Organizations map 1:1 to Workspaces
- Public pages live at `/w/[orgSlug]`

## Portfolio builder
- Public portfolio has exactly 3 pages: Home, Gallery, Contact
- Source of truth: `Workspace.publicPage`
- Do not create separate portfolio-related collections unless explicitly needed
- Shared Puck config powers editor and renderer
- Contact form is fixed
- Inquiry submission creates `Inquiry` + match/create `Client` + inquiry-status `Booking` in one transaction
- Owner converts inquiry into booked work from the app; no in-app quote negotiation flow in MVP

## Cloudinary
- Browser uploads go direct via signed endpoint
- Store both `url` and `cloudinaryPublicId`
- Thumbnails are derived from URL transforms
- Delete remote asset when deleting image-bearing docs

## Billing
- Paddle replaces HitPay for Gallurio subscription billing
- Paddle is Merchant of Record for subscriptions
- Use Vercel Workflow DevKit for durable checkout flows that wait on Paddle webhook confirmation
- Keep `Workspace.plan` provider-agnostic: `free | starter | pro`
- Workspace billing fields:
  - `paddleSubscriptionId`
  - `paddleCustomerId`
  - `paddleSubscriptionStatus`
  - `paddleCurrentPeriodEnd`
  - `paddleCheckoutWorkflowRunId`
- Paddle recurring prices are pre-created in the dashboard and referenced by env vars
- Webhook verification must use raw body + HMAC before parsing
- Webhooks run on Node, not Edge
- Checkout flow:
  - create Paddle checkout
  - start checkout workflow
  - save workflow run id
  - wait for `subscription.activated`
  - resume workflow
  - update workspace plan/status/period end
- Handle:
  - `subscription.activated`
  - `subscription.updated`
  - `subscription.canceled`
  - `subscription.past_due`
  - `transaction.completed`
- Marketplace / split payments are not in MVP
- Workspace owners collect end-client payments outside the app in MVP

## Billing env
- `PADDLE_API_KEY`
- `PADDLE_WEBHOOK_SECRET`
- `PADDLE_API_BASE`
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`
- `PADDLE_PRICE_STARTER_ID`
- `PADDLE_PRICE_PRO_ID`

## Encoding safety
- Never output or save mojibake or broken-encoding text
- Preserve UTF-8 in all files and generated content
- Verify user-facing Unicode characters render correctly
- Fix corrupted text before continuing; do not guess
- Prefer ASCII in code/config unless Unicode is intentionally required

## i18n
- Locales: `en`, `fil`, `ms`, `id`, `th`
- Routes under `app/[locale]/...`
- Use ICU message formatting
- Public workspace chrome uses workspace country locale, not visitor locale

## Git workflow
- Branch from `dev`
- Branch name format: `action/pages-context`
- All worktrees must live under `.claude/worktrees/`
- Never create worktrees outside `.claude/worktrees/`
- Create with:
  `git worktree add .claude/worktrees/<slug> -b <branch> dev`

## Testing
- Every code change ships with tests
- Test data-layer code, components, handlers, validators, and tenant isolation
- Mock external services only
- Do not mock Mongoose; use in-memory Mongo where needed
- Run relevant tests during development
- Billing tests must cover:
  - Paddle webhook signature verification
  - price/plan mapping
  - workflow resume behavior
  - tenant isolation for billing updates
- Before marking done, pass:
  - affected tests
  - `pnpm typecheck`
  - `pnpm lint`

## Done criteria
A task is done only when:
- implementation is complete
- tests are added and passing
- lint and typecheck pass
- locales are updated
- mobile view is checked at 375px
- optimistic behavior is implemented where appropriate
- errors are surfaced properly
- indexes are confirmed for new queries

## Review / merge flow
- Consolidate locales
- Build
- Run strict code review
- Save review as markdown
- Fix review findings
- Merge to `dev` only after review and explicit approval

## Commands
- `pnpm dev`
- `pnpm start`
- `pnpm seed`
- Prefer RTK for diff/log/read/test/lint/type/build flows when appropriate

## References
- `SaaS-Blueprint.md`
- `docs/portfolio-maker/`
- `docs/RELEASE-CHECKLIST.md`
- `docs/booking-inquiry-lifecycle.md`
- `docs/notifications-scope.md`
- `node_modules/next/dist/docs/01-app/`
- `node_modules/@clerk/nextjs/dist/types/`
- `@C:\Users\alexb\.codex\RTK.md`