# Gallurio documentation index

Read `CLAUDE.md` and `AGENTS.md` first. This page routes durable project documentation; release readiness is verified from the live configuration, deployment evidence, and current code.

## Module references

| Area | Reference |
| --- | --- |
| Billing, beta lifecycle, and paid-billing gate | `docs/modules/billing.md` |
| Authentication and tenancy | `docs/modules/auth-tenancy.md` |
| Core CRM domain | `docs/modules/core-domain.md` |
| Hosting, scheduled jobs, and endpoint hardening | `docs/modules/hosting-ops.md` |
| Locales, RTL, and app design | `docs/modules/i18n-design.md` |
| Portfolio and Cloudflare Images | `docs/modules/portfolio-and-media.md` |
| Currency conversion and restatement | `docs/pricing/currency-conversion.md` |

## Other durable references

- `deploy/README.md` and `deploy/VPS-ACCESS.md` cover the production host and operator access.
- `REUSABLE_CODE.md` is the shared component, hook, and helper catalog.
- `PRODUCT.md` and `DESIGN.md` are the product and design sources of truth.
- `.env.example` and `lib/env.ts` define the environment contract.

## Documentation hygiene

Keep only durable operational or architectural references. Remove completed feature plans, audits, reviews, and handoff work orders when their material has shipped, and repair any inbound references in the same change.
