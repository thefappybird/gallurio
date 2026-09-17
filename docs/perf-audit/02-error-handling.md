# Perf audit: error handling — score 6/10

## What's working
- Three-tier `error.tsx` coverage: `app/global-error.tsx` (root), `app/(public)/error.tsx` (all public/marketing routes), `app/[locale]/(app)/error.tsx` (whole authenticated app shell via inheritance).
- Server Actions mostly follow a consistent `try { … } catch { return { error: "..." } }` typed-result convention: `app/[locale]/(app)/settings/_actions.ts` (14 try/catch blocks), `app/[locale]/(app)/inquiries/_actions.ts` (10).
- `app/api/webhooks/lemonsqueezy/route.ts:48-155` is the best example in the codebase — try/catch around signature verification (line 48), the atomic ledger claim (line 99, distinguishes duplicate-key races from real errors), and handler dispatch (line 145), all logged before returning a typed status.
- No empty `catch {}` / `catch (e) {}` swallow blocks found anywhere under `app/` — errors that are caught are handled, not silently dropped.
- `sonner` toast is used in 42+ client components to surface Server Action failures to the user (settings, bookings, clients, teams, inquiries, portfolio, onboarding) — a well-established, non-optional convention, not an outlier.

## Gaps
- **Missing dedicated `error.tsx` on the two most disruptive segments to crash silently:**
  - `app/[locale]/(app)/portfolio/` — has `loading.tsx` but no own `error.tsx`. A Puck crash mid-edit falls back to the generic `(app)/error.tsx` with no path to recover an unsaved draft.
  - `app/[locale]/(app)/settings/billing/` — same gap; a crash mid-checkout/mid-subscription-management falls back to the generic boundary.
  - `/w/[orgSlug]` public page — no boundary of its own either (only `not-found.tsx` at the layout level), relies entirely on the shared `(public)/error.tsx`.
- **`lib/actions/billing.ts` has zero try/catch.** `getSubscriptionManageUrlAction` / `verifyCheckoutReturnAction` rely on typed early-return guards but let anything thrown by `getLemonSqueezySubscription` / `Workspace.findById` bubble up uncaught — the one action file that breaks the typed-result convention, in the highest-stakes area (billing).
- `app/[locale]/(app)/portfolio/_actions.ts` has only 4 try/catch blocks relative to its size (~21K) — lighter coverage than sibling action files.
- **`app/api/images/direct-upload/route.ts:16-34`** has no try/catch around the Cloudflare Images `requestDirectUpload` call (line 28) — a Cloudflare failure throws uncaught, falling through to Next's default 500 with no explicit log line.

## Fix direction
Add try/catch (typed result) to `lib/actions/billing.ts` and `app/api/images/direct-upload/route.ts`. Add scoped `error.tsx` to the portfolio editor and billing settings segments — these are exactly the flows where a generic "something went wrong" loses the most (an unsaved draft, a checkout in progress).
