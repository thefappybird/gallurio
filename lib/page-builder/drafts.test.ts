import { describe, it, expect } from "vitest";
import { draftCapForPlan, DEFAULT_DRAFT_NAME, DRAFT_NAME_MAX } from "./drafts";

describe("draftCapForPlan", () => {
  it("caps free at 5, starter at 15, pro unlimited", () => {
    expect(draftCapForPlan("free")).toBe(5);
    expect(draftCapForPlan("starter")).toBe(15);
    expect(draftCapForPlan("pro")).toBe(Number.POSITIVE_INFINITY);
  });

  it("caps beta the same as pro (unlimited)", () => {
    expect(draftCapForPlan("beta")).toBe(draftCapForPlan("pro"));
  });

  it("falls back to the free cap for an unknown plan", () => {
    // @ts-expect-error testing runtime fallback
    expect(draftCapForPlan("enterprise")).toBe(5);
  });

  it("exposes the default name and max length", () => {
    expect(DEFAULT_DRAFT_NAME).toBe("New Draft");
    expect(DRAFT_NAME_MAX).toBe(60);
  });
});
