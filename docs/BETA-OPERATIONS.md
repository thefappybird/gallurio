# Beta operations runbook

This is the operator process for admitting beta testers, announcing the end of beta, closing beta, and managing the base promo codes.

## How beta access works

`BETA_TESTER_ENABLED=true` permits new users to select beta access during onboarding. It grants full Pro-level beta access without payment.

Setting `BETA_TESTER_ENABLED=false` only stops **new** beta activations. It does not affect people who are already on the beta plan.

Existing beta access ends only when an operator runs the close command below. Closing beta is one-way: it marks the global beta program closed and prevents future beta activation even if the environment variable is turned back on.

## Announce the end of beta

Choose a target end date at least seven days ahead, then run this from the repository with the intended database configured in `DATABASE_URL`:

```powershell
pnpm beta:schedule-end -- --ends-at=2026-08-15T00:00:00Z --operator=alex --allow-dev
```

Replace:

- `2026-08-15T00:00:00Z` with the target date and time in ISO 8601 format.
- `alex` with the operator name, user ID, or support ticket reference.

The command does not change anyone's access. Starting seven days before the target date, every workspace currently on the beta plan sees an app-wide banner explaining that beta access will end soon and the workspace will return to the free plan.

Users can dismiss the banner for their current browser session. It reappears in a new browser session until beta is actually closed.

If timing changes, run the schedule command again with the new date. The banner stays visible after a passed target date until beta is closed, so users are not silently left on an expired announcement.

## Close beta manually

When you are ready to end beta, first set `BETA_TESTER_ENABLED=false` in the deployed environment. Then run:

```powershell
pnpm beta:close -- --operator=alex --allow-dev --confirm-close
```

This command:

1. Records the global beta program as closed.
2. Moves ordinary beta workspaces to the free plan and starts the normal gated-access lifecycle.
3. Applies a queued promo grant instead of downgrading a beta workspace that has one waiting.
4. Removes the beta-ending banner because beta is now closed.

For a production-looking database target, replace `--allow-dev` with `--i-understand-production`. The scripts print only a redacted database host/name fingerprint before they make changes.

## Base promo codes

The development full seed and `promo:seed-base` command create these single-redemption promo codes:

| Code | Access |
| --- | --- |
| `MONTHPRO2026` | One month of Pro |
| `YEARPRO2026` | One year of Pro |
| `LIFETIME2026` | Perpetual Pro |
| `BETA2PRO` | Two months of Pro for a verified beta participant; eligibility and one-time identity redemption are enforced server-side |

Beta access itself has no promo code: eligible users use the beta-tester onboarding flow. `BETA2PRO` is the separate post-beta thank-you offer.

To create only these four base promos in any configured database (without adding demo data), run:

```powershell
pnpm promo:seed-base -- --allow-dev
```

For production, use `--i-understand-production` instead. The command is idempotent: it creates missing codes and leaves any existing code records unchanged.

To create another promo code later:

```powershell
pnpm seed:promo -- --code=SUMMER2026 --title="Summer Pro" --type=monthly --allow-dev
```

Supported types are `monthly`, `yearly`, `lifetime`, `beta`, and `beta2mo`. Add `--expires-at=2026-12-31` only when the code should stop accepting new redemptions. A promo-code expiry does not revoke access already granted.

## One-time redemption support exception

Promo redemptions are one-time per workspace. To allow a specific workspace to redeem one previously-used code once more, run:

```powershell
pnpm promo:allow-redemption -- --workspace-id=<workspace-id> --code=MONTHPRO2026 --operator=<ticket-or-operator> --reason="Billing correction" --allow-dev
```

The command requires an operator and a reason, creates a workspace activity record, and does not log the raw promo code. It only reopens the redemption gate; the workspace owner must submit the code again through the normal promo form.
