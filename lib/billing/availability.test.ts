import { afterEach, describe, expect, it } from "vitest";
import { isPaidBillingAvailable } from "./availability";

const ORIGINAL = process.env.BETA_TESTER_ENABLED;

describe("isPaidBillingAvailable", () => {
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.BETA_TESTER_ENABLED;
    else process.env.BETA_TESTER_ENABLED = ORIGINAL;
  });

  it("is false while beta-only mode is enabled", () => {
    process.env.BETA_TESTER_ENABLED = "true";
    expect(isPaidBillingAvailable()).toBe(false);
  });

  it("is true when beta-only mode is unset", () => {
    delete process.env.BETA_TESTER_ENABLED;
    expect(isPaidBillingAvailable()).toBe(true);
  });
});
