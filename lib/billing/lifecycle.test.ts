import { describe, it, expect } from "vitest";
import {
  addDays,
  lifecycleResetFields,
  PRE_EXPIRY_WARN_DAYS,
  REMIND_1_DAYS,
  REMIND_2_DAYS,
  WIPE_DAYS,
} from "./lifecycle";

describe("lifecycle constants", () => {
  it("exposes the documented offset days", () => {
    expect(PRE_EXPIRY_WARN_DAYS).toBe(7);
    expect(REMIND_1_DAYS).toBe(30);
    expect(REMIND_2_DAYS).toBe(51);
    expect(WIPE_DAYS).toBe(58);
  });
});

describe("addDays", () => {
  it("adds whole days to a date, including negative offsets", () => {
    const base = new Date("2026-01-01T00:00:00.000Z");
    expect(addDays(base, 7).toISOString()).toBe("2026-01-08T00:00:00.000Z");
    expect(addDays(base, -7).toISOString()).toBe("2025-12-25T00:00:00.000Z");
  });
});

describe("lifecycleResetFields", () => {
  it("returns a dot-path $set fragment nulling every lifecycle timestamp", () => {
    expect(lifecycleResetFields()).toEqual({
      "lifecycle.lapsedAt": null,
      "lifecycle.warned7dAt": null,
      "lifecycle.expiredNotifiedAt": null,
      "lifecycle.remind1moAt": null,
      "lifecycle.remind7wkAt": null,
      "lifecycle.wipedAt": null,
    });
  });
});
