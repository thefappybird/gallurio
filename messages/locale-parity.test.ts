import { describe, expect, it } from "vitest";
import en from "./en.json";
import fil from "./fil.json";
import id from "./id.json";
import ms from "./ms.json";
import ar from "./ar.json";

// Full-catalog parity guard. Every non-English catalog must carry the exact same
// key tree as English — a missing key renders the raw key path to users, and an
// extra key is dead weight that drifts out of sync. Added when Arabic (ar / RTL)
// shipped; covers the whole tree, not just individual blocks.
const LOCALES = { fil, id, ms, ar } as Record<string, typeof en>;

function deepKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const out: string[] = [];
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out.push(prefix + key);
    out.push(...deepKeys((value as Record<string, unknown>)[key], `${prefix}${key}.`));
  }
  return out.sort();
}

describe("locale catalog parity", () => {
  const enKeys = deepKeys(en);

  for (const [locale, catalog] of Object.entries(LOCALES)) {
    it(`${locale}.json matches the English key tree exactly`, () => {
      expect(deepKeys(catalog)).toEqual(enKeys);
    });
  }
});
