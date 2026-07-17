---
name: run-gallurio
description: Run, start, launch, build, or screenshot the Gallurio app locally and drive it in a real browser. Use to boot the Next.js dev server and sign in as the seeded owner to verify a UI change, capture screenshots (desktop + 375px mobile), or confirm a flow works end-to-end — not just that it compiles.
---

# Run Gallurio

Gallurio is a multi-tenant CRM SaaS on **Next.js 16** + a custom `server.ts`
(Next + socket.io). It is **not** driven by `next dev` — `pnpm dev` runs
`tsx server.ts`. There is no static landing page: every meaningful surface is
behind auth, so the way to actually see the app is to **sign in and drive it**.

The agent handle is **[`.claude/skills/run-gallurio/driver.mjs`](driver.mjs)** —
it launches headless Chromium, signs in as the seeded owner (Turnstile is
bypassed in dev), navigates any route, and writes screenshots at desktop +
375px. The project's own Playwright e2e harness (`e2e/`) is the human/CI path.

> The README is stock `create-next-app` boilerplate — ignore it.
> Paths below are relative to the repo root (`D:\Portfolio\Projects\gallurio`).
> This is a **Windows** project; the primary shell is **PowerShell**.

## Prerequisites

- **Node 24+, pnpm 10+** (`node -v` → v24.x, `pnpm -v` → 10.x here).
- **`.env.local` with 34 keys** — Mongo `DATABASE_URL`, WorkOS, Cloudflare
  Images, Paddle, Resend, and the `SEED_OWNER_*` / `SEED_STAFF_*` / `SEED_LEAD_*`
  accounts. The canonical `dev` checkout already has it. A **worktree starts
  without one** — copy it from the canonical checkout first (never commit it).
- **Playwright + its chromium browser.** The browser is cached under
  `%LOCALAPPDATA%\ms-playwright`, but `@playwright/test` itself may be missing
  from `node_modules` even so. Restore it with the install step below.

## Build / setup

```bash
pnpm install --frozen-lockfile
```

Run this if `node -e "require.resolve('@playwright/test')"` throws, or after a
fresh clone/worktree. It also pulls `cross-env`, which `pnpm dev` needs.

## Run (agent path) — driver

**1. Start the dev server** (background; several seconds to ready).
`NODE_ENV=development` is what bypasses Turnstile:

```bash
pnpm dev
```

Wait for `> Ready on http://localhost:3000` in the output. Sanity check:

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:3000/sign-in
```

**2. Drive it.** Sign in + screenshot. **Use PowerShell** so a leading-slash
route reaches node intact:

```powershell
node .claude/skills/run-gallurio/driver.mjs /dashboard
node .claude/skills/run-gallurio/driver.mjs /dashboard --mobile
```

From **Git Bash**, pass routes **without** the leading slash (MSYS rewrites
`/dashboard` into a Windows path). Multiple routes share one login:

```bash
node .claude/skills/run-gallurio/driver.mjs inquiries calendar
```

Screenshots land in `./.driver-shots/` (gitignored) as `<route>-<width>.png`
(`-1280` desktop, `-375` mobile). On failure the driver writes
`.driver-shots/error.png` showing the page state. Flags: `--mobile` (375px),
`--out <dir>`. Routes accept `/dashboard`, `dashboard`, or a full URL.

## Run (human / CI path) — Playwright e2e

The repo ships a Playwright harness: `e2e/auth.setup.ts` logs in once and saves
`storageState`, specs reuse it, and `playwright.config.ts` **reuses an already
running** `pnpm dev` (only spawns one if nothing is on `:3000`).

```bash
pnpm exec playwright test
```

## Checks

```bash
pnpm test          # vitest, uses mongodb-memory-server (no live DB needed)
pnpm typecheck     # tsc --noEmit
pnpm lint          # eslint
```

Honest state at the time this skill was written:
- `pnpm test` runs the vitest suite against an in-memory Mongo — no `.env.local`
  or running server required.
- **`pnpm typecheck` currently fails on a stale `.next` artifact**, not on real
  source. `.next/types/validator.ts` still references removed `clerk` / `hitpay`
  routes from before the WorkOS/Paddle migration. Clear `.next`, then re-run —
  as two steps, not `&&` (a running dev server locks a Turbopack cache file, so
  `rm -rf .next` may warn "Directory not empty"; that's harmless, the stale
  `types/` are gone and typecheck then exits 0):

  ```bash
  rm -rf .next
  pnpm typecheck
  ```
- `pnpm lint` reports pre-existing warnings (unused vars, etc.) unrelated to the
  run flow.

## Gotchas

- **`pnpm dev` is `tsx server.ts`, not `next dev`.** It boots Next **and**
  socket.io. If it dies with `'cross-env' is not recognized`, deps aren't fully
  installed — run `pnpm install --frozen-lockfile`.
- **Turnstile bypass depends on `NODE_ENV=development`.** `pnpm dev` sets it via
  cross-env. A bare `tsx server.ts` defaults `NODE_ENV` to **production**
  (deliberate, so the bypass can't leak), and login will then demand a Turnstile
  token the driver can't supply.
- **Git Bash mangles leading-slash args.** `node driver.mjs /dashboard` in Git
  Bash navigates to `http://localhost:3000C:/Program Files/Git/dashboard` and
  fails. Use PowerShell, or pass the route with no leading slash.
- **First authenticated route is slow.** Turbopack compiles `/dashboard` cold on
  first hit — the driver waits up to 90s for the post-login redirect. Not a hang.
- **`@playwright/test` can be absent while its browser cache is present.** A
  cached `ms-playwright` chromium does *not* mean the npm package is installed;
  `require.resolve('@playwright/test')` is the real check.
- **Seeded data is shared and live.** The driver only reads (login + navigate +
  screenshot). Don't add destructive submits — the dev DB is shared/seeded.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `'cross-env' is not recognized` from `pnpm dev` | `pnpm install --frozen-lockfile` |
| `Cannot find package '@playwright/test'` | `pnpm install --frozen-lockfile` |
| `Cannot navigate to invalid URL ...C:/Program Files/Git/...` | Git Bash path mangling — use PowerShell or drop the leading slash |
| `SEED_OWNER_EMAIL ... missing from .env.local` | Copy `.env.local` from the canonical `dev` checkout into the worktree |
| Login never redirects / `waitForURL` times out | Confirm `pnpm dev` (not `next dev`) is running with `NODE_ENV=development`; check `.driver-shots/error.png` |
