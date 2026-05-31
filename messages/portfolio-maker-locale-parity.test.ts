import { describe, it, expect } from "vitest";
import en from "./en.json";
import fil from "./fil.json";
import id from "./id.json";
import ms from "./ms.json";
import th from "./th.json";

// Guards against structural drift in the portfolio-maker locale blocks. A crash
// or a mis-anchored translation insert once nested `pageBuilder` under
// `inquiries` in th.json; this test would have caught it. We assert the four
// non-English catalogs carry the exact same key TREE as English for the blocks
// added across Phases 6–9 (we do not assert values — those are translated).
const LOCALES = { fil, id, ms, th } as Record<string, typeof en>;
const BLOCKS = ["inquiries", "pageBuilder"] as const;

function deepKeys(value: unknown, prefix = ""): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const out: string[] = [];
  for (const key of Object.keys(value as Record<string, unknown>)) {
    out.push(prefix + key);
    out.push(...deepKeys((value as Record<string, unknown>)[key], `${prefix}${key}.`));
  }
  return out.sort();
}

describe("portfolio-maker locale parity", () => {
  for (const block of BLOCKS) {
    const enKeys = deepKeys((en.app as Record<string, unknown>)[block]);

    for (const [locale, catalog] of Object.entries(LOCALES)) {
      it(`${locale}: app.${block} matches the English key tree`, () => {
        const localeKeys = deepKeys((catalog.app as Record<string, unknown>)[block]);
        expect(localeKeys).toEqual(enKeys);
      });

      it(`${locale}: does not nest pageBuilder under inquiries`, () => {
        const inquiries = (catalog.app as Record<string, { pageBuilder?: unknown }>).inquiries;
        expect(inquiries?.pageBuilder).toBeUndefined();
      });
    }
  }
});
