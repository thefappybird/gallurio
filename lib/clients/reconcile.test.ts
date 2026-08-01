import { describe, expect, it } from "vitest";
import { reconcileClient } from "./reconcile";

describe("reconcileClient", () => {
  it("flags a filled-vs-different-filled field as a conflict", () => {
    // The only one of the four cases that is a question for the user.
    const result = reconcileClient(
      { name: "Ana", email: "ana@old.com", phone: null, notes: "", tags: [] },
      { name: "Ana", email: "ana@new.com", phone: null, notes: "", tags: [] }
    );
    expect(result.conflicts).toEqual([
      { field: "email", existingValue: "ana@old.com", typedValue: "ana@new.com" },
    ]);
    expect(result.additive).toEqual([]);
  });

  it("fills a blank existing field from the typed value without prompting", () => {
    const result = reconcileClient(
      { name: "Ana", email: null, phone: null, notes: "", tags: [] },
      { name: "Ana", email: "ana@example.com", phone: null, notes: "", tags: [] }
    );
    expect(result.additive).toEqual([{ field: "email", value: "ana@example.com" }]);
    expect(result.conflicts).toEqual([]);
  });

  it("keeps the existing value when the typed field is blank, and says nothing", () => {
    // Non-destructive: a blank input must never wipe stored data, and the user
    // is not asked about a decision that was never theirs to make.
    const result = reconcileClient(
      { name: "Ana", email: "ana@example.com", phone: "+639171234567", notes: "VIP", tags: [] },
      { name: "Ana", email: "", phone: null, notes: "   ", tags: [] }
    );
    expect(result.additive).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("reports no conflicts for identical records, so the UI can skip the step", () => {
    // The common case: linking must be silent, never showing a resolution step.
    const same = {
      name: "Ana",
      email: "ana@example.com",
      phone: "+639171234567",
      notes: "VIP",
      tags: ["wedding"],
    };
    const result = reconcileClient(same, { ...same });
    expect(result.conflicts).toEqual([]);
    expect(result.additive).toEqual([]);
  });

  it("unions tags instead of treating them as a conflict", () => {
    const result = reconcileClient(
      { name: "Ana", tags: ["wedding", "vip"] },
      { name: "Ana", tags: ["vip", "referral"] }
    );
    expect(result.tags).toEqual(["wedding", "vip", "referral"]);
    expect(result.conflicts).toEqual([]);
  });
});
