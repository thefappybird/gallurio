# Module: Hosting, Ops & Endpoint Hardening

## Production hosting

Target: Hetzner VPS (materially cheaper than Vercel at steady state) — Ubuntu LTS, Docker Engine + Compose, Caddy reverse proxy on 80/443 → the Gallurio app container on a private host port. GitHub Actions builds, tests, typechecks, and publishes an immutable image; **the VPS never runs `next build` or installs dependencies** — it only pulls and runs the published image. The app connects out to MongoDB Atlas and the selected billing provider's API (Lemon Squeezy today) — there is no separate billing database or worker process.

`vercel.json`'s `crons` entry is dead config on this host (only fires if deployed on Vercel, which this isn't) — the systemd timers below are the real schedule source.

### Tenant subdomains (`*.gallurio.com`)

Published portfolios are served on per-tenant subdomains. Operator setup (Cloudflare Origin CA wildcard cert, DNS, the Caddy `*.gallurio.com` site block, the `GALLURIO_WILDCARD_HOST`/`GALLURIO_ORIGIN_CERT`/`GALLURIO_ORIGIN_KEY` env) lives in `deploy/README.md` — not duplicated here. The app-side pieces:

- **Routing (`proxy.ts`)**, gated on `NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN` (no-op when unset): a `{slug}.{base}` host is rewritten to `/w/{slug}` before auth+intl run (mirrors the `/w/` bypass); the canonical host (apex or `www`) 301-redirects `/w/{slug}(/subpath)` to the subdomain. A **reserved-label denylist** (`lib/portfolio/reservedSlugs.ts`: `www,auth,autoconfig,dev,send,staging,app,api,admin,mail,static,cdn,assets,status`) is skipped in the rewrite and rejected as a workspace slug. The 301 validates the captured slug against `WORKSPACE_SLUG_RE` before using it as the redirect host label — an unvalidated value containing `:` would drop the `.{base}` suffix and open-redirect off the trusted apex.
- **`NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN=gallurio.com`** must stay set (build-time GitHub Actions var + matching runtime env). It both drives the public URL display and gates the proxy rewrite/redirect; unsetting it silently reverts every portfolio link to path-based `/w/{slug}`.
- **`/opengraph-image`** (the platform root OG image, not locale-prefixed) gets an early proxy bypass — falling through to intl would rewrite it under `/[locale]` and 404.
- **Cookie posture**: session cookies stay **host-only**. Never set `WORKOS_COOKIE_DOMAIN` (or any AuthKit cookie-domain option) to `.gallurio.com` — a domain-scoped cookie would be sent to every tenant subdomain, leaking an authenticated session to a public page. See `docs/modules/auth-tenancy.md`.

### Scheduled jobs (systemd timers, not Vercel Cron)

Two cron routes, both Node runtime, timing-safe Bearer `CRON_SECRET` auth (401 without it):
- `/api/cron/release-expired-invite-seats` — hourly.
- `/api/cron/billing-lifecycle` — daily; stamps `Workspace.lifecycle.*` per `docs/modules/billing.md`'s lifecycle timeline.

Driven by systemd timers on Hetzner (`deploy/systemd/gallurio-invite-seats.{service,timer}`, `deploy/systemd/gallurio-billing-lifecycle.{service,timer}`) — each unit is a `curl --fail --max-time <n>` against the local app with an `Authorization: Bearer` header from a root-only env file:

```
sudo install -m 600 -o root -g root /dev/null /etc/gallurio/cron.env
sudo tee /etc/gallurio/cron.env <<'EOF'
CRON_SECRET=<same value as the app's CRON_SECRET env var>
APP_ORIGIN=http://127.0.0.1:3000
EOF
sudo cp deploy/systemd/gallurio-invite-seats.* deploy/systemd/gallurio-billing-lifecycle.* /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now gallurio-invite-seats.timer gallurio-billing-lifecycle.timer
```

`CRON_SECRET` in `/etc/gallurio/cron.env` must match the app process's own `CRON_SECRET` runtime env var — never log or print it. Status: `systemctl list-timers`, `journalctl -u gallurio-invite-seats.service`. Each `.service` has a commented `OnFailure=` hook for wiring a failed-unit alert once a notify target exists — a failed run is otherwise silent outside `systemctl --failed`.

## Endpoint hardening

Acceptance criteria for every Server Action, Route Handler, and public/server-component data loader.

- **Rate limiting / abuse control**: every public or cheaply-abusable endpoint (inquiry submit, signed upload, public reads, auth callback, search) has throttling and/or a challenge (honeypot + `rateLimit()`; Turnstile where spam-prone). Bound client-supplied `limit`/`cursor`. Prod runs on Hetzner with no edge WAF — app-level limiting (`lib/server/rateLimit.ts`, in-memory/best-effort) is the only layer.
- **Error handling never breaks the app**: no empty/log-only catches that continue with bad state; every external call (Lemon Squeezy, Cloudflare, WorkOS, Mongo, email) gets a timeout + graceful failure; every async route/page tree has `error.tsx` or try/catch. Webhooks ack 200 after signature verification even when the handler fails, then dead-letter/log — never 500 into a provider retry loop. Never collapse malformed JSON into `{}`.
- **DB efficiency**: no query-per-item loops — batch with `$in`/`bulkWrite`/aggregation. Project to needed fields, `.lean()` reads, cursor-paginate, and confirm a `{ workspaceId, ... }` compound index backs each query shape and sort.
- **Auth on every page/route**: every authenticated page calls `requireOrg()`, every server action `ownerContext()`/`requireRole()`, every route handler an explicit identity or signature check. Never rely on middleware alone. See `docs/modules/auth-tenancy.md`.
- **Secret exposure**: never log tokens/sessions/cookies/headers, never return session state to the client or serialize it into props, never put a secret in a `NEXT_PUBLIC_` var.
- **Tenant isolation**: Mongo has no row-level security — application code is the only enforcement. See the Multi-tenant rules in CLAUDE.md and `docs/modules/auth-tenancy.md`.

## Beta operations

Beta-program admission/close/promo-code ops commands are documented in full in `docs/modules/billing.md` (Beta program lifecycle section) since they're operationally inseparable from the billing lifecycle they drive.
