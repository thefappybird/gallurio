import { describe, it, expect } from "vitest";
import { isWorkspaceGated } from "./access";

describe("isWorkspaceGated", () => {
  it("is not gated when free and never subscribed", () => {
    expect(isWorkspaceGated({ plan: "free", everSubscribed: false })).toBe(false);
  });

  it("is gated when free after having ever subscribed", () => {
    expect(isWorkspaceGated({ plan: "free", everSubscribed: true })).toBe(true);
  });

  it("is not gated on an active paid plan", () => {
    expect(isWorkspaceGated({ plan: "pro", everSubscribed: true })).toBe(false);
  });

  it("is not gated on a paid plan even if never subscribed (defensive)", () => {
    expect(isWorkspaceGated({ plan: "pro", everSubscribed: false })).toBe(false);
  });
});
