import { describe, expect, it } from "vitest";
import { defaultPostAuthPath } from "./postAuthLanding";

describe("defaultPostAuthPath", () => {
  it("sends completed owners to dashboard", () => {
    expect(
      defaultPostAuthPath(
        { memberships: [{ role: "owner" }], onboardingCompletedAt: new Date() },
        "en",
      ),
    ).toBe("/dashboard");
  });

  it("sends incomplete owners to onboarding", () => {
    expect(
      defaultPostAuthPath(
        { memberships: [{ role: "owner" }], onboardingCompletedAt: null },
        "en",
      ),
    ).toBe("/onboarding");
  });

  it("sends staff members to bookings", () => {
    expect(
      defaultPostAuthPath(
        { memberships: [{ role: "staff" }], onboardingCompletedAt: null },
        "en",
      ),
    ).toBe("/bookings");
  });

  it("sends users without memberships to onboarding", () => {
    expect(
      defaultPostAuthPath({ memberships: [], onboardingCompletedAt: null }, "en"),
    ).toBe("/onboarding");
  });

  it("localizes non-default locales", () => {
    expect(
      defaultPostAuthPath(
        { memberships: [{ role: "staff" }], onboardingCompletedAt: null },
        "fil",
      ),
    ).toBe("/fil/bookings");
  });
});
