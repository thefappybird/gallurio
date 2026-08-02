// Paid billing is an explicit launch gate, independent from free beta access.
// Keep this fail-closed: checkout, customer-portal, and billing-management
// actions stay unavailable until production credentials, products, and
// webhooks are configured and PAID_BILLING_ENABLED is set to "true".
export function isPaidBillingAvailable(): boolean {
  return process.env.PAID_BILLING_ENABLED === "true";
}
