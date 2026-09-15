import path from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { readButtonPaint } from "./helpers";

const FOREIGN_CSV = path.join(__dirname, "fixtures", "bookings-foreign-headers.csv");
const VALID_CSV = path.join(__dirname, "fixtures", "bookings-valid.csv");
const VALID_XLSX = path.join(__dirname, "fixtures", "bookings-valid.xlsx");

const SHEET = '[data-slot="sheet-content"]';

// toolbar.import per locale — the toolbar button's accessible name is
// translated, so an English-literal locator misses non-English locales.
const IMPORT_BUTTON_LABEL: Record<string, string> = {
  "": "Import",
  fil: "Mag-import",
  id: "Impor",
  th: "นำเข้า",
  ar: "استيراد",
};

async function openImportSheet(page: Page, localePrefix = ""): Promise<void> {
  const code = localePrefix.replace(/^\//, "");
  await page.goto(`${localePrefix}/bookings`);
  const clickImport = () =>
    page.getByRole("button", { name: IMPORT_BUTTON_LABEL[code] }).click();
  await clickImport();
  try {
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 3_000 });
  } catch {
    // th locale hits a genuine hydration mismatch on the bookings list
    // (server vs client weekday format — see the bug reported alongside this
    // spec), which remounts the toolbar and can eat the very first click.
    // Retry once rather than let every locale run flake on an unrelated bug.
    await clickImport();
    await expect(page.getByRole("dialog")).toBeVisible();
  }
}

async function uploadFile(page: Page, filePath: string): Promise<void> {
  await page.locator('input[type="file"]').setInputFiles(filePath);
}

test.describe("Scenario A - foreign file, desktop 1280", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("foreign CSV auto-maps columns, flags endAt correctly, and reaches review", async ({
    page,
  }) => {
    await openImportSheet(page);

    // upload step visible
    await expect(page.getByRole("button", { name: /Drop a CSV or XLSX/i })).toBeVisible();

    await uploadFile(page, FOREIGN_CSV);

    // lands on map step; dropzone AND preview table both gone (one step at a time)
    await expect(page.getByText("Match your columns to ours")).toBeVisible();
    await expect(page.getByRole("button", { name: /Drop a CSV or XLSX/i })).toHaveCount(0);
    await expect(page.locator(`${SHEET} table`)).toHaveCount(0);

    // chips: 9 columns / 3 rows
    await expect(page.getByText("9 columns")).toBeVisible();
    await expect(page.getByText("3 rows")).toBeVisible();

    const mapped: Record<string, string> = {
      clientName: "Customer",
      title: "Event",
      startAt: "Date",
      endAt: "End Date",
      amountTotal: "Package Price",
      amountDeposit: "Deposit Paid",
      status: "Deal Status",
      locationAddress: "Venue",
      clientEmail: "Email Address",
    };

    for (const [field, expectedHeader] of Object.entries(mapped)) {
      const trigger = page.locator(`#map-${field}`);
      // Exact text match, not substring: "End Date" contains "Date" as a
      // substring, so a substring check would pass even if startAt and endAt
      // were swapped. This is the highest-value bug to catch here.
      await expect(trigger, `field ${field} should show "${expectedHeader}"`).toHaveText(
        expectedHeader
      );
    }

    // each assigned card shows a "First row: ..." sample line
    const sampleLines = page.getByText(/^First row: /);
    expect(await sampleLines.count()).toBeGreaterThan(0);

    // Advanced section collapsed; expand -> the 6 round-trip fields appear
    const advancedToggle = page.getByRole("button", { name: /Advanced and round-trip columns/i });
    await expect(advancedToggle).toHaveAttribute("aria-expanded", "false");
    const advancedFields = [
      "bookingId",
      "sessionIndex",
      "clientId",
      "payments",
      "locationLat",
      "locationLng",
    ];
    for (const field of advancedFields) {
      await expect(page.locator(`#map-${field}`)).toHaveCount(0);
    }
    await advancedToggle.click();
    await expect(advancedToggle).toHaveAttribute("aria-expanded", "true");
    for (const field of advancedFields) {
      await expect(page.locator(`#map-${field}`)).toBeVisible();
    }

    // Continue -> values step (Deal Status has "Confirmed" x2 and "Pencilled in" x1,
    // neither is a recognized BOOKING_STATUSES member)
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByText("Match your values to ours")).toBeVisible();
    await expect(page.getByText("Pencilled in")).toBeVisible();
    await expect(page.getByText("Confirmed", { exact: true })).toBeVisible();

    // answer every unmatched value so all 3 rows stay valid
    const valueTriggers = page.locator(`${SHEET} li [data-slot="select-trigger"]`);
    const triggerCount = await valueTriggers.count();
    expect(triggerCount).toBe(2);
    for (let i = 0; i < triggerCount; i++) {
      // Keyboard select rather than clicking an option node: the just-closed
      // popup's item lingers mid exit-animation and still reads as "visible"
      // to a bare selector, so a mouse click races a stale element from the
      // previous iteration instead of the one currently open.
      await valueTriggers.nth(i).click();
      await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
    }

    await page.getByRole("button", { name: "Continue" }).click();

    // review step
    await expect(page.getByText("3 row(s) found")).toBeVisible();
    // all 3 rows valid = money (PHP 85,000.00 / ₱45,000 / 28,500.00) and dates
    // (06/15/2027 etc.) all normalized without a coercion error
    await expect(page.getByText("3 valid")).toBeVisible();
    await expect(page.getByText(/with errors$/)).toHaveCount(0);
    const firstRow = page.locator(`${SHEET} table tbody tr`).first();
    await expect(firstRow).toContainText("2027");

    const importButton = page.getByRole("button", { name: /Import 3 booking/i });
    await expect(importButton).toBeVisible();
    await expect(importButton).toBeEnabled();
    // DO NOT CLICK IT.
  });
});

test.describe("Scenario B - auto-skip", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("canonical CSV skips straight to review", async ({ page }) => {
    await openImportSheet(page);
    await uploadFile(page, VALID_CSV);

    await expect(page.getByText("Columns matched automatically")).toBeVisible();
    await expect(page.getByText("Match your columns to ours")).toHaveCount(0);

    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByText("Match your columns to ours")).toBeVisible();
  });
});

test.describe("Scenario C - XLSX skeleton", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("XLSX round-trips through server parsing to a correct map/review state", async ({
    page,
  }) => {
    await openImportSheet(page);

    await uploadFile(page, VALID_XLSX);

    const caughtSkeleton = await page
      .getByText("Reading your file")
      .waitFor({ state: "visible", timeout: 800 })
      .then(() => true)
      .catch(() => false);

    // End state must be correct regardless of whether we caught the skeleton.
    await expect(page.getByText("Columns matched automatically")).toBeVisible({ timeout: 15_000 });

    test.info().annotations.push({
      type: "note",
      description: caughtSkeleton
        ? "Reading your file skeleton was observed"
        : "Reading your file skeleton was too fast to observe reliably",
    });
  });
});

test.describe("Scenario D - responsive + i18n", () => {
  test("foreign CSV map step has no horizontal overflow at 375 and 768", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openImportSheet(page);
    await uploadFile(page, FOREIGN_CSV);
    await expect(page.getByText("Match your columns to ours")).toBeVisible();

    const sheetBody = page.locator(SHEET);
    let box = await sheetBody.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      offsetWidth: (el as HTMLElement).offsetWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
    // effectively full-width at 375
    expect(box.offsetWidth).toBeGreaterThanOrEqual(box.viewportWidth - 2);

    await page.setViewportSize({ width: 768, height: 900 });
    box = await sheetBody.evaluate((el) => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
      offsetWidth: (el as HTMLElement).offsetWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(box.scrollWidth).toBeLessThanOrEqual(box.clientWidth + 1);
  });

  const locales = ["fil", "id", "th", "ar"];

  for (const code of locales) {
    test(`map step renders real translated strings for locale ${code}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await openImportSheet(page, `/${code}`);
      await uploadFile(page, FOREIGN_CSV);

      const heading = page.locator(`${SHEET} h3`).first();
      await expect(heading).toBeVisible();
      const headingText = (await heading.innerText()).trim();

      // not a raw i18n key, not a mojibake marker
      expect(headingText).not.toMatch(/^app\.bookings\.import/);
      expect(headingText).not.toContain("?");
      expect(headingText.length).toBeGreaterThan(0);

      if (code === "ar") {
        const dir = await page.evaluate(() => document.documentElement.getAttribute("dir"));
        expect(dir).toBe("rtl");

        const sheetBody = page.locator(SHEET);
        const noOverflow = await sheetBody.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
        expect(noOverflow).toBe(true);

        const cardNoOverflow = await page.locator('[id^="map-"]').first().evaluate((el) => {
          const card = el.closest("div.bg-card") as HTMLElement | null;
          if (!card) return false;
          return card.scrollWidth <= card.clientWidth + 1;
        });
        expect(cardNoOverflow).toBe(true);
      }
    });
  }

  test("dark mode: card background and foreground text differ", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await openImportSheet(page);
    await uploadFile(page, FOREIGN_CSV);
    await expect(page.getByText("Match your columns to ours")).toBeVisible();

    await page.evaluate(() => document.documentElement.classList.add("dark"));

    const card = page
      .locator("#map-clientName")
      .locator("xpath=ancestor::div[contains(@class,'bg-card')][1]");
    const paint = await readButtonPaint(card);

    expect(paint.labelRgb).not.toEqual(paint.effectiveRgb);
    expect(paint.labelRgb.a).toBeGreaterThan(0);
  });
});
