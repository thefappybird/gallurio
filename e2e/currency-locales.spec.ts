import { test, expect, type Page } from "@playwright/test";

// Public pricing page — anonymous, same reason as pricing-local-estimate.spec.ts.
test.use({ storageState: { cookies: [], origins: [] } });

// Locally there is no CF-IPCountry header, so the local-currency estimate
// always falls back to USD; the billed currency is the workspace default,
// PHP. The billed-currency code itself is never translated (ISO code stays
// Latin script even inside the Arabic/Thai sentence).
const LOCALE_WORDS: Record<string, RegExp> = {
  en: /billed in PHP/,
  fil: /siningil sa PHP/,
  id: /ditagih dalam PHP/,
  ar: /تُحصَّل بعملة PHP/,
  th: /เรียกเก็บเป็น PHP/,
};

const LOCALES = Object.keys(LOCALE_WORDS);

function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  return errors;
}

function hasOverflow(page: Page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth
  );
}

// 1. All 5 locales x /pricing, mobile + desktop, light theme (default).
test.describe("1. locale coverage on /pricing", () => {
  for (const locale of LOCALES) {
    for (const width of [375, 768, 1280]) {
      test(`${locale} estimate renders correctly at ${width}px`, async ({ page }) => {
        const errors = trackConsoleErrors(page);
        await page.setViewportSize({ width, height: 900 });
        await page.goto(`/${locale}/pricing`);

        // /pricing carries two estimates (monthly price + yearly note); this
        // suite checks the rendered string per locale, so the first is enough.
        const note = page.getByText(LOCALE_WORDS[locale]).first();
        await expect(note).toBeVisible();

        const text = await note.textContent();
        expect(text).toContain("≈");
        expect(text).toMatch(/\d/);

        expect(await hasOverflow(page), "document has horizontal overflow").toBe(false);
        expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
      });
    }
  }
});

// 2. ar (RTL) — highest-risk case: bidi ordering, bleed, overflow.
test.describe("2. ar RTL geometry", () => {
  for (const width of [375, 768, 1280]) {
    test(`ar pricing card stays RTL without bleed at ${width}px`, async ({ page }) => {
      const errors = trackConsoleErrors(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/ar/pricing");

      await expect(page.locator("html")).toHaveAttribute("dir", "rtl");

      const note = page.getByText(LOCALE_WORDS.ar).first();
      await expect(note).toBeVisible();
      const card = note.locator('xpath=ancestor::*[@data-slot="card"]');
      await expect(card).toHaveCount(1);

      const noteBox = await note.boundingBox();
      const cardBox = await card.boundingBox();
      expect(noteBox).not.toBeNull();
      expect(cardBox).not.toBeNull();
      expect(noteBox!.width).toBeGreaterThan(0);
      // No bleed outside the parent card's box (1px tolerance for subpixel rounding).
      expect(noteBox!.x).toBeGreaterThanOrEqual(cardBox!.x - 1);
      expect(noteBox!.x + noteBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width + 1);
      expect(noteBox!.y).toBeGreaterThanOrEqual(cardBox!.y - 1);
      expect(noteBox!.y + noteBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height + 1);

      await card.screenshot({ path: `test-results/ar-pricing-card-${width}.png` });

      expect(await hasOverflow(page), "document has horizontal overflow").toBe(false);
      expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
    });
  }
});

// 3. Dark theme, en + ar, 1280px — the estimate must not disappear into the
// dark card background. Theme is driven the same way next-themes reads it:
// the "theme" localStorage key next-themes' blocking init script consumes on
// first paint (attribute="class", so it lands as html.dark).
test.describe("3. dark theme visibility", () => {
  for (const locale of ["en", "ar"]) {
    test(`${locale} estimate stays visible against the dark card at 1280px`, async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.setItem("theme", "dark");
      });
      const errors = trackConsoleErrors(page);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`/${locale}/pricing`);

      await expect(page.locator("html")).toHaveClass(/dark/);

      const note = page.getByText(LOCALE_WORDS[locale]).first();
      await expect(note).toBeVisible();
      const card = note.locator('xpath=ancestor::*[@data-slot="card"]');
      await expect(card).toHaveCount(1);

      const noteColor = await note.evaluate((el) => getComputedStyle(el).color);
      const cardBg = await card.evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(noteColor).not.toBe(cardBg);

      await card.screenshot({ path: `test-results/dark-${locale}-pricing-card-1280.png` });

      expect(await hasOverflow(page), "document has horizontal overflow").toBe(false);
      expect(errors, `console errors: ${errors.join(" | ")}`).toEqual([]);
    });
  }
});
