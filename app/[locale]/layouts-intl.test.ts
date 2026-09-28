import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guard against a future app/[locale]/<folder> shipping with no layout.tsx
// (silently inheriting the root provider's near-empty ROOT_CLIENT_MESSAGE_KEYS
// catalog) or with a provider that picks the wrong catalog shape. Every
// branch except (marketing) must use the bare <NextIntlClientProvider>
// (inherits the full request-locale catalog); (marketing) must scope down
// via a `messages=` prop. See lib/i18n/clientMessages.ts.
describe("app/[locale] route branches pick a client message catalog", () => {
  const localeDir = path.resolve(__dirname);
  const branches = fs
    .readdirSync(localeDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  it("found more than one route branch to check", () => {
    expect(branches.length).toBeGreaterThan(1);
  });

  for (const branch of branches) {
    it(`${branch} has a layout.tsx using the expected NextIntlClientProvider shape`, () => {
      const layoutPath = path.join(localeDir, branch, "layout.tsx");
      expect(fs.existsSync(layoutPath), `${branch}/layout.tsx is missing`).toBe(true);

      const source = fs.readFileSync(layoutPath, "utf8");
      const match = source.match(/<NextIntlClientProvider(\s[^>]*)?>/);
      expect(match, `${branch}/layout.tsx has no <NextIntlClientProvider>`).not.toBeNull();

      const hasMessagesProp = /messages=/.test(match?.[1] ?? "");
      if (branch === "(marketing)") {
        expect(hasMessagesProp, `${branch}/layout.tsx must pass messages= to scope its catalog`).toBe(true);
      } else {
        expect(hasMessagesProp, `${branch}/layout.tsx must use the bare provider (no messages=)`).toBe(false);
      }
    });
  }
});
