import { afterEach, describe, expect, it } from "vitest";
import { isPaidBillingAvailable } from "./availability";

const ORIGINAL_PAID_BILLING = process.env.PAID_BILLING_ENABLED;
const ORIGINAL_BETA_TESTER = process.env.BETA_TESTER_ENABLED;

describe("isPaidBillingAvailable", () => {
  afterEach(() => {
    if (ORIGINAL_PAID_BILLING === undefined) delete process.env.PAID_BILLING_ENABLED;
    else process.env.PAID_BILLING_ENABLED = ORIGINAL_PAID_BILLING;
    if (ORIGINAL_BETA_TESTER === undefined) delete process.env.BETA_TESTER_ENABLED;
    else process.env.BETA_TESTER_ENABLED = ORIGINAL_BETA_TESTER;
  });

  it("is false until paid billing is explicitly enabled", () => {
    delete process.env.PAID_BILLING_ENABLED;
    process.env.BETA_TESTER_ENABLED = "true";
    expect(isPaidBillingAvailable()).toBe(false);
  });

  it("is true when paid billing is enabled alongside beta access", () => {
    process.env.PAID_BILLING_ENABLED = "true";
    process.env.BETA_TESTER_ENABLED = "true";
    expect(isPaidBillingAvailable()).toBe(true);
  });
});
