import { describe, it, expect } from "vitest";
import { buildPuckDictionary, PUCK_CHROME_KEYS } from "./puckDictionary";
import en from "../../messages/en.json";
import fil from "../../messages/fil.json";
import id from "../../messages/id.json";
import ar from "../../messages/ar.json";
import th from "../../messages/th.json";

const CATALOGS = { en, fil, id, ar, th } as Record<string, { puck?: { chrome?: Record<string, string> } }>;

describe("buildPuckDictionary", () => {
  it("returns exactly the Puck chrome keys, each resolved via the raw accessor", () => {
    const dictionary = buildPuckDictionary((key) => `raw:${key}`);
    expect(Object.keys(dictionary).sort()).toEqual([...PUCK_CHROME_KEYS].sort());
    for (const key of PUCK_CHROME_KEYS) {
      expect(dictionary[key]).toBe(`raw:${key}`);
    }
  });
});

describe("puck.chrome message catalogs", () => {
  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}.json has a non-empty string for every Puck chrome key`, () => {
      const chrome = catalog.puck?.chrome ?? {};
      for (const key of PUCK_CHROME_KEYS) {
        expect(typeof chrome[key]).toBe("string");
        expect(chrome[key]?.length).toBeGreaterThan(0);
      }
    });
  }

  const enChrome = en.puck.chrome as Record<string, string>;
  const PLACEHOLDER_RE = /\{[a-z]+\}/g;

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    if (locale === "en") continue;
    it(`${locale}.json keeps every {placeholder} from the English value verbatim`, () => {
      const chrome = catalog.puck?.chrome ?? {};
      for (const key of PUCK_CHROME_KEYS) {
        const expectedPlaceholders = (enChrome[key].match(PLACEHOLDER_RE) ?? []).sort();
        const actualPlaceholders = (chrome[key]?.match(PLACEHOLDER_RE) ?? []).sort();
        expect(actualPlaceholders).toEqual(expectedPlaceholders);
      }
    });
  }

  // Guards against a copy-paste of the English strings into a non-English catalog.
  // A handful of legitimate coincidental matches are allowed (e.g. "Outline" reused
  // in a Latin-script locale); anything past this is a red flag.
  const MAX_ALLOWED_MATCHES_WITH_ENGLISH = 3;

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    if (locale === "en") continue;
    it(`${locale}.json shares at most ${MAX_ALLOWED_MATCHES_WITH_ENGLISH} values with the English catalog`, () => {
      const chrome = catalog.puck?.chrome ?? {};
      const matches = PUCK_CHROME_KEYS.filter((key) => chrome[key] === enChrome[key]);
      expect(matches.length).toBeLessThanOrEqual(MAX_ALLOWED_MATCHES_WITH_ENGLISH);
    });
  }
});
