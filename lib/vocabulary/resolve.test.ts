import { describe, expect, it } from "vitest";
import { isVocabularyPresetId, resolveVocabularyPreset } from "./resolve";

describe("resolveVocabularyPreset", () => {
  it("explicit preset wins over businessType", () => {
    expect(resolveVocabularyPreset({ vocabularyPreset: "venue", businessType: "planner" })).toBe("venue");
  });
  it("falls back to businessType when it is a preset id", () => {
    expect(resolveVocabularyPreset({ businessType: "catering" })).toBe("catering");
    expect(resolveVocabularyPreset({ vocabularyPreset: null, businessType: "stylist" })).toBe("stylist");
  });
  it("other/unknown/undefined -> standard", () => {
    expect(resolveVocabularyPreset({ businessType: "other" })).toBe("standard");
    expect(resolveVocabularyPreset({ businessType: "zzz" })).toBe("standard");
    expect(resolveVocabularyPreset({})).toBe("standard");
  });
  it("type guard", () => {
    expect(isVocabularyPresetId("artists")).toBe(true);
    expect(isVocabularyPresetId("nope")).toBe(false);
    expect(isVocabularyPresetId(undefined)).toBe(false);
  });
});
