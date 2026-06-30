import { describe, expect, it } from "vitest";
import en from "./en.json";
import fil from "./fil.json";
import id from "./id.json";
import ms from "./ms.json";
import ar from "./ar.json";

// Guards against structural drift in the portfolio-maker locale blocks. A crash
// or a mis-anchored translation insert once nested `pageBuilder` under
// `inquiries`; this test would have caught it. We assert the three non-English
// catalogs carry the exact same key tree as English for the blocks added across
// Phases 6-9 (we do not assert translated values).
const LOCALES = { fil, id, ms, ar } as Record<string, typeof en>;
const BLOCKS = ["inquiries", "pageBuilder"] as const;
// Root-level blocks added in Phase 5 (invite/team flow).
const ROOT_BLOCKS = ["inviteAccept"] as const;

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

  for (const [locale, catalog] of Object.entries(LOCALES)) {
    it(`${locale}: advertises en, fil, ms, id, and ar app-interface language options`, () => {
      expect(Object.keys(catalog.app.settings.customize.languages)).toEqual([
        "en",
        "fil",
        "ms",
        "id",
        "ar",
      ]);
    });
  }

  // Root-level block parity (Phase 5 — invite/team flow).
  for (const block of ROOT_BLOCKS) {
    const enKeys = deepKeys((en as Record<string, unknown>)[block]);

    for (const [locale, catalog] of Object.entries(LOCALES)) {
      it(`${locale}: root.${block} matches the English key tree`, () => {
        const localeKeys = deepKeys((catalog as Record<string, unknown>)[block]);
        expect(localeKeys).toEqual(enKeys);
      });
    }
  }
});
