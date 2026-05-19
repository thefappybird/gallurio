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
- **pnpm** as package manager.

## Design style

- **Sharp edges, no rounding.** `--radius: 0rem` in `globals.css` — all buttons, inputs, cards, modals, badges, and dropdowns are square-cornered. Do not add `rounded-*` classes to any UI element. Do not change `--radius`.
- **Solid, minimal aesthetic.** Prefer flat surfaces and strong borders over shadows and gradients. Use `border` over `shadow` for depth.
- **shadcn `base-nova` style** — semantic color tokens only (`bg-primary`, `text-muted-foreground`). Never raw color values like `bg-blue-500`.

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
  api/
    webhooks/{stripe,clerk}/
    inquiries/           # public form submissions
  admin/                 # super-admin (gated)
lib/
  db/
    mongoose.ts          # cached connection (Vercel-safe)
    models/              # Mongoose models, one file each
  auth/
    requireOrg.ts        # resolve { userId, clerkOrgId, role, workspace }
  validators/            # Zod schemas mirroring models
  utils.ts               # cn() and small helpers
components/
  ui/                    # shadcn primitives (add as needed)
proxy.ts                 # Clerk auth proxy (Next.js 16 file name)
```

## Multi-tenant security rules (read every time you write a DB query)

1. **Never trust client-supplied `workspaceId`.** Always derive it from `requireOrg()` which reads the Clerk session.
2. **Every tenant-scoped query MUST include `workspaceId`** in the filter. There is no Mongoose global plugin enforcing this yet — add `workspaceId` explicitly to every `find*`, `update*`, `delete*` call.
3. **Verify ownership before mutating by `_id`.** Always combine `{ _id, workspaceId }` in the filter, never `{ _id }` alone.
4. **Public routes (under `(public)` and `/api/inquiries`) must validate `orgSlug` → `workspaceId`** before reading any document.

## Commands

```bash
pnpm dev          # next dev (Turbopack)
pnpm build        # next build
pnpm start        # next start
pnpm lint         # eslint
pnpm typecheck    # tsc --noEmit
```

The dev server will fail to start without `.env.local`. Copy `.env.example` and fill in at minimum:
- `DATABASE_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

## Conventions

- **Server Components by default.** Mark client components with `"use server"` only when needed (forms, drag handlers, charts).
- **Server Actions** for form mutations inside the app. Route Handlers for webhooks and public APIs.
- **Models** use the `mongoose.models.X ?? mongoose.model(...)` pattern to survive HMR.
- **Imports** use the `@/*` alias rooted at the project directory.
- **Indexes** are declared in the schema file. Every compound index starts with `workspaceId`.
- **No JSDoc, minimal comments.** Names should explain themselves. Only comment WHY when non-obvious.
- **No barrel files except for `lib/db/models/index.ts`.** Otherwise import from the specific file.

## What's NOT in MVP

Do not add these without explicit discussion: staff/team roles, custom domains, contract e-signature, WhatsApp/SMS integration, AI features, native mobile, marketplace, vendor directory, multi-currency accounting, internal team chat. See `D:\Portfolio\Projects\SaaS-Blueprint.md` for the full scope decisions.

## Reference

- Full SaaS blueprint: `D:\Portfolio\Projects\SaaS-Blueprint.md` (one level up from this repo).
- Next.js 16 docs (local): `node_modules/next/dist/docs/01-app/`
- Clerk Next.js types: `node_modules/@clerk/nextjs/dist/types/`
