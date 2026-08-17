# Currency conversion

Two separate things use one FX source:

1. **Local price estimate** — the Pro subscription price is shown with an
   approximate equivalent in the visitor's currency (`≈ $4.30 · billed in PHP`).
   Display only. Lemon Squeezy always charges the store currency by variant id.
2. **Workspace roll-up** — dashboard totals convert every booking and
   transaction into the workspace currency before summing, so a workspace with
   a USD-paying client still gets one correct PHP figure.

## Why the app does this and not Lemon Squeezy

Lemon Squeezy has a single store currency, used across its dashboard, checkout
and receipt emails. There is no per-country currency setting and no purchasing
power parity — [it is an open feature request](https://lemonsqueezy.nolt.io/445),
not a configuration option. So the estimate is ours to compute, and the amount
charged stays in the store currency regardless of what the visitor is shown.

## Files

| File | Role |
| --- | --- |
| `lib/pricing/fxRates.ts` | Fetches the daily USD rate table, caches it 24h, returns `null` on any failure |
| `lib/pricing/countryCurrency.ts` | ISO country → currency table, USD fallback |
| `lib/pricing/localPricing.ts` | `getDisplayPricing()` — live LS price + local estimate |
| `lib/pricing/currencyConverter.ts` | `buildRateMap` / `convertAmount` / `convertedAmountExpr` |
| `lib/pricing/workspaceRates.ts` | `getWorkspaceRateMap()` — which currencies a workspace stores |
| `components/app/local-price-note.tsx` | The `≈ … · billed in …` line |

Country comes from Cloudflare's `CF-IPCountry` header (production sits behind
proxied Cloudflare DNS). It is spoofable when the origin is reached directly,
which is harmless: it only picks which approximate figure to render. Unknown or
absent country falls back to USD.

## Provider

Open Exchange Rates, via the existing `OPENEXCHANGERATES_APP_ID`. The free plan
serves one USD-based table per call (`base` is a paid feature), so every
non-USD pair is cross-rated off that table — one fetch a day covers every
currency in the app, well inside the free plan's 1,000 requests/month.

The ECB feed (`api.frankfurter.dev`) was rejected: it publishes ~30 currencies
and none of the Gulf ones, which would leave the `ar` locale without rates.

## Adding it to the VPS

`OPENEXCHANGERATES_APP_ID` is a **server-side runtime secret**. It goes in the
VPS environment file only — **not** GitHub Actions.

GitHub Actions only builds and publishes the image; the VPS supplies runtime
env. `deploy/README.md` states the rule directly: application secrets "remain
only in `/etc/gallurio/gallurio.env` on the VPS." Only `NEXT_PUBLIC_*` values
are build-time and belong in Actions — this key is not one of them, and putting
it there would bake a secret into a published image layer.

On the VPS, as a user with sudo:

```sh
# 1. Append the key to the runtime env file (root-owned, group-readable by gallurio)
sudo sh -c 'printf "OPENEXCHANGERATES_APP_ID=%s\n" "<your-app-id>" >> /etc/gallurio/gallurio.env'

# 2. Confirm the file's permissions are unchanged
sudo ls -l /etc/gallurio/gallurio.env   # expect -rw-r----- root gallurio

# 3. Recreate the container so it picks up the new environment
cd /opt/gallurio
docker compose up -d --wait

# 4. Verify the app is healthy
curl --fail --silent --show-error 'http://127.0.0.1:3000/api/health?ready=1'
```

Get the App ID from <https://openexchangerates.org> → App IDs. Do not print the
value into shell history you keep, and do not commit it.

### Verifying it works

- Visit `/pricing` from outside the Philippines (or with a proxy). A second
  muted line appears under the price: `≈ $4.30 · billed in PHP`.
- With the key unset, that line is simply absent and the PHP price renders
  alone — the feature fails closed, it never shows a wrong number.
- Server logs print `[fx] Failed to fetch reference rates, currency conversion
  disabled: …` when the API call itself fails.

## Known limitations

- **`Client.totalSpent` is not converted.** It is a denormalized running total
  maintained at write time in `lib/db/clientTransactions.ts`, in whatever
  currency the booking used. Converting it correctly means storing the rate at
  write time plus a backfill, which is a separate change. The clients table
  renders each client's own `currency`, so nothing is currently mislabelled —
  but a mixed-currency workspace's `totalSpent` ordering is not meaningful.
- **Rates are indicative.** Daily reference rates, not the rate a card issuer
  or Lemon Squeezy applies. Never present a converted figure as an amount
  charged.
- **The rate map is resolved per dashboard render** (two `distinct` queries,
  workspace-scoped). If dashboard latency becomes a concern, cache the map per
  workspace rather than dropping the conversion.
