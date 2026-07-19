// Beta-only launch mode: no Merchant of Record has been selected/approved yet
// (see docs/RELEASE-CHECKLIST.md). While BETA_TESTER_ENABLED is "true", paid
// checkout, the customer portal, and billing-management actions must stay
// unavailable everywhere they're reachable. This is the single source of
// truth for that gate — server actions/routes fail closed on it, UI hides or
// disables the affected controls on it. Gated purely by the env var (not
// NODE_ENV) so it can be flipped on in any environment, matching
// activateBetaTesterAction's own check.
export function isPaidBillingAvailable(): boolean {
  return process.env.BETA_TESTER_ENABLED !== "true";
}
