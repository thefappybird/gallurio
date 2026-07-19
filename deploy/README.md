# Gallurio production deployment artifacts

For normal operator SSH access, see [VPS-ACCESS.md](VPS-ACCESS.md).

The VPS runs only the pre-built Gallurio image. GitHub Actions builds and
publishes it; the VPS pulls a pinned immutable tag or digest. Do not install
dependencies, run `next build`, or build images on the VPS.

Next.js embeds every `NEXT_PUBLIC_*` value into browser bundles while GitHub
Actions builds the image. Configure those public values as protected GitHub
Actions environment variables before the first release; they still must match
the runtime values in `/etc/gallurio/gallurio.env`. Never put a secret in a
`NEXT_PUBLIC_*` value.

## Files and secret boundaries

- `compose.yml`: application container only. It binds port 3000 to loopback so
  the app is reachable only through host Caddy.
- `/etc/gallurio/gallurio.env`: root-controlled application environment file.
  It contains runtime secrets and is never copied into an image or repository.
- `/opt/gallurio/.env`: root-controlled Compose-only file containing the
  immutable `GALLURIO_IMAGE=ghcr.io/<owner>/gallurio@sha256:<digest>` value.
- `/etc/caddy/Caddyfile`: copied from `deploy/Caddyfile`. Its systemd
  environment supplies `CADDY_EMAIL`, `GALLURIO_CANONICAL_HOST`, and
  `GALLURIO_REDIRECT_HOST`; none are application secrets.

## GitHub Actions setup

Create a protected `production` GitHub Actions environment. The release and
rollback workflows use it to create a deployment record and, if configured,
require approval before SSH access to the VPS.

Set these **GitHub Actions variables** (public build-time configuration):

- `NEXT_PUBLIC_APP_URL=https://gallurio.com`
- `NEXT_PUBLIC_WORKOS_REDIRECT_URI=https://gallurio.com/api/auth/callback`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH`
- Optional: `NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN` and the four
  `NEXT_PUBLIC_SOCIAL_*_URL` values.

Set these **GitHub Actions environment secrets**:

- `VPS_HOST`: the VPS address.
- `VPS_USER`: the non-root deployment user, normally `gallurio`.
- `VPS_SSH_PRIVATE_KEY`: the dedicated deployment key.
- `VPS_SSH_KNOWN_HOSTS`: the exact expected SSH known-hosts line(s), captured
  out-of-band and reviewed before saving. Do not use `ssh-keyscan` during a
  deployment.

Do not add `DATABASE_URL`, WorkOS secrets, Resend secrets, Cloudflare Images
tokens, cron secrets, or future billing-provider secrets to GitHub Actions.
They remain only in `/etc/gallurio/gallurio.env` on the VPS.

The GitHub token publishes `ghcr.io/<owner>/gallurio`. Before the first
deployment, configure the package visibility/access policy and sign in to GHCR
on the VPS as the deployment user with a read-only package token.

## VPS deployment commands

Run these on the VPS after Docker Engine, the Compose plugin, Caddy, and GHCR
read-only authentication are configured:

```sh
sudo install -d -m 750 -o gallurio -g gallurio /opt/gallurio
sudo install -m 644 -o gallurio -g gallurio deploy/compose.yml /opt/gallurio/compose.yml

# The Docker Compose client runs as gallurio, so this root-controlled file is
# group-readable by gallurio. Docker access itself is privileged; do not grant
# it to any untrusted account.
sudo install -d -m 750 -o root -g gallurio /etc/gallurio
sudo install -m 640 -o root -g gallurio /dev/null /etc/gallurio/gallurio.env
# Fill /etc/gallurio/gallurio.env manually with the final runtime environment.

# Create /opt/gallurio/.env out-of-band with exactly one immutable image value:
# GALLURIO_IMAGE=ghcr.io/<owner>/gallurio@sha256:<digest>

cd /opt/gallurio
docker compose pull
docker compose up -d --wait
curl --fail --silent --show-error 'http://127.0.0.1:3000/api/health?ready=1'
```

The health endpoint must be healthy before Caddy is reloaded or traffic is
shifted. Keep the previous image digest in the prior `/opt/gallurio/.env`
revision so rollback is a deliberate `docker compose up -d --wait` using that
known-good digest.

## Caddy

Install the supplied environment file and systemd drop-in, set the real
canonical and redirect hosts, validate the config, then reload:

```sh
sudo install -m 600 -o root -g caddy deploy/caddy/gallurio.env.example /etc/caddy/gallurio.env
sudo install -d -m 755 /etc/systemd/system/caddy.service.d
sudo install -m 644 deploy/caddy/caddy.service.d/gallurio.conf /etc/systemd/system/caddy.service.d/gallurio.conf
sudo systemctl daemon-reload
sudo caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
sudo systemctl reload caddy
```

Open only 80/443 according to the selected Cloudflare origin strategy. Keep
port 3000 private; systemd timers call it through `http://127.0.0.1:3000`.

## Release and rollback

After the final commit SHA is frozen, run **Release** from the Actions tab and
enter that exact full SHA. The workflow reruns verification, pushes an image
tagged by SHA, deploys its immutable digest, waits for readiness, and records
the image in the workflow summary. Keep that digest for rollback.

Use **Roll back production** only with a previously recorded immutable image
digest and an incident reason. It replaces `/opt/gallurio/.env`, pulls the old
image, waits for readiness, and records the rollback in the protected GitHub
environment.
