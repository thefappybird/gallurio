import { describe, expect, it } from "vitest";
import { VOCABULARY_PRESET_IDS, getTerms } from "./presets";

const CONCEPTS = ["inquiry", "booking", "client", "team"] as const;
const LOCALES = ["en", "fil", "id", "ar", "th"] as const;

describe("presets", () => {
  it("every preset has 4 concepts x 5 locales with non-empty terms", () => {
    for (const p of VOCABULARY_PRESET_IDS)
      for (const c of CONCEPTS)
        for (const l of LOCALES) {
          const t = getTerms(p, l, c);
          expect(t.singular.length, `${p}/${c}/${l}`).toBeGreaterThan(0);
          expect(t.plural.length, `${p}/${c}/${l}`).toBeGreaterThan(0);
        }
  });
});
