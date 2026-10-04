/**
 * Public contact form: end time follows start time.
 *  - Behaviour on the live public page at 375 / 768 / 1280 × light + dark.
 *  - Rendering of the time labels in all 5 form locales (preview route, the
 *    owner-controlled formLocale), light + dark, with ar RTL in-bounds.
 * Inspects only — never submits.
 */
import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

const SLUG = "seed-owner-demo";
const BREAKPOINTS = [375, 768, 1280] as const;
const SCHEMES = ["light", "dark"] as const;
const LOCALES = ["en", "fil", "id", "ar", "th"] as const;
type Catalog = { publicPage: { inquiryForm: { startTime: string; endTime: string } } };
const CATALOGS = Object.fromEntries(
  LOCALES.map((l) => [l, JSON.parse(readFileSync(`messages/${l}.json`, "utf8")) as Catalog])
) as Record<(typeof LOCALES)[number], Catalog>;

async function openContact(page: Page) {
  await page.waitForFunction(
    () => typeof (window as unknown as { __gallurioOpenContact?: unknown }).__gallurioOpenContact === "function",
    undefined,
    { timeout: 20_000 }
  );
  await page.evaluate(() =>
    (window as unknown as { __gallurioOpenContact: () => void }).__gallurioOpenContact()
  );
  await showEventTab(page);
}

// Session times live on the 2nd tab ("Event details"); pick it by position so
// it works in every form locale.
async function showEventTab(page: Page) {
  const tab = page.getByRole("tab").nth(1);
  await tab.waitFor({ timeout: 20_000 });
  await tab.click();
}

test.describe("public contact form time sync", () => {
  for (const scheme of SCHEMES) {
    test(`live form behaviour @ 375/768/1280 (${scheme})`, async ({ browser }) => {
      test.setTimeout(180_000);
      const context = await browser.newContext({ storageState: "e2e/.auth/owner.json", colorScheme: scheme, viewport: { width: 1280, height: 900 } });
      const page = await context.newPage();
      await page.goto(`/w/${SLUG}`, { waitUntil: "networkidle" });
      await openContact(page);
      const start = page.locator("#cf-stime-0");
      const end = page.locator("#cf-etime-0");
      await expect(start).toBeVisible({ timeout: 15_000 });
      let i = 0;
      for (const width of BREAKPOINTS) {
        await page.setViewportSize({ width, height: 900 });
        await start.scrollIntoViewIfNeeded();
        const s = ["18:00", "20:15", "21:30"][i];
        const e = ["19:00", "21:15", "22:30"][i];
        i++;
        await start.fill(s);
        await expect(end, `${width}: end follows start`).toHaveValue(e);
        await end.fill("08:00");
        await end.blur();
        await expect(end, `${width}: end below start snaps on blur`).toHaveValue(e);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${width}: no horizontal overflow`).toBeLessThanOrEqual(1);
        // All three tabs fully visible (the modal clips overflow silently).
        const tabFit = await page.getByRole("tablist").first().evaluate((list) => {
          const tabs = Array.from(list.querySelectorAll('[role="tab"]'));
          const box = (list.parentElement ?? list).getBoundingClientRect();
          const last = tabs[tabs.length - 1]?.getBoundingClientRect();
          return { overflowRight: last ? Math.round(last.right - box.right) : 999, listScroll: list.scrollWidth - list.clientWidth };
        });
        expect(tabFit.overflowRight, `${width}: third tab not clipped`).toBeLessThanOrEqual(1);
        expect(tabFit.listScroll, `${width}: tab row does not overflow`).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `test-results/contact-sync/${scheme}-${width}.png` });
      }
      // 23:30 clamps to 23:59, never wraps.
      await start.fill("23:30");
      await expect(end).toHaveValue("23:59");
      await context.close();
    });

    test(`5 form locales render time labels @ 375 (${scheme})`, async ({ browser }) => {
      test.setTimeout(180_000);
      const context = await browser.newContext({ storageState: "e2e/.auth/owner.json", colorScheme: scheme, viewport: { width: 375, height: 812 } });
      const page = await context.newPage();
      for (const locale of LOCALES) {
        const dir = locale === "ar" ? "&formDir=rtl" : "";
        await page.goto(`/en/portfolio-preview?zone=contact&formLocale=${locale}${dir}`, {
          waitUntil: "networkidle",
        });
        await showEventTab(page);
        const labels = CATALOGS[locale].publicPage.inquiryForm;
        const startLabel = page.locator('label[for="cf-stime-0"]');
        const endLabel = page.locator('label[for="cf-etime-0"]');
        await expect(startLabel, `${locale}: start label`).toHaveText(labels.startTime, { timeout: 20_000 });
        await expect(endLabel, `${locale}: end label`).toHaveText(labels.endTime);
        const box = await page.locator("#cf-etime-0").boundingBox();
        expect(box, `${locale}: end input has a box`).not.toBeNull();
        expect(box!.x, `${locale}: end input inside viewport`).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width, `${locale}: end input inside viewport`).toBeLessThanOrEqual(376);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth
        );
        expect(overflow, `${locale}: no horizontal overflow`).toBeLessThanOrEqual(1);
        await page.screenshot({ path: `test-results/contact-sync/preview-${scheme}-${locale}.png` });
      }
      await context.close();
    });
  }
});
