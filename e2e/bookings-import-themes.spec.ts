import path from "node:path";
import { test, expect, type Locator, type Page } from "@playwright/test";

/**
 * Batched verification for the import-sheet + invoice-theme wave: one session
 * per surface, every assertion walked without re-navigating. Nothing is
 * submitted — the import button and the theme save are inspected, not clicked.
 */

const MESSY_CSV = path.join(__dirname, "fixtures", "bookings-messy.csv");
const SHEET = '[data-slot="sheet-content"]';
const SHOTS = path.join(__dirname, ".artifacts", "import-themes");

async function sheetWidth(page: Page): Promise<number> {
  return page.locator(SHEET).evaluate((el) => (el as HTMLElement).getBoundingClientRect().width);
}

async function expectInsideViewport(page: Page, locator: Locator, label: string) {
  const box = await locator.boundingBox();
  const vp = page.viewportSize()!;
  expect(box, `${label} has a box`).not.toBeNull();
  expect(box!.x, `${label} left`).toBeGreaterThanOrEqual(0);
  expect(box!.y, `${label} top`).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width, `${label} right`).toBeLessThanOrEqual(vp.width + 1);
  expect(box!.y + box!.height, `${label} bottom`).toBeLessThanOrEqual(vp.height + 1);
}

/** Opens the last visible column picker and checks its popup fits on screen. */
async function checkLastPickerFits(page: Page, label: string) {
  const triggers = page.locator(`${SHEET} [data-slot="select-trigger"]`);
  const last = triggers.last();
  await last.scrollIntoViewIfNeeded();
  await last.click();
  const popup = page.locator('[data-slot="select-content"]').last();
  await expect(popup).toBeVisible();
  await page.waitForTimeout(250); // open animation
  await expectInsideViewport(page, popup, `${label} popup`);
  await page.screenshot({ path: path.join(SHOTS, `${label}-popup.png`) });
  await page.keyboard.press("Escape");
  await expect(popup).toBeHidden();
}

test("Run A - import sheet: pickers, labels, combine, dates, preview, resize", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(MESSY_CSV);
  await expect(page.getByText("Match your columns to ours")).toBeVisible();

  // Human labels, no field keys or kind badges.
  const sheet = page.locator(SHEET);
  await expect(sheet.getByText("Client name", { exact: true })).toBeVisible();
  await expect(sheet.getByText("clientName", { exact: true })).toHaveCount(0);
  await expect(sheet.getByText("Choice", { exact: true })).toHaveCount(0);

  // First + Last auto-combined into client name.
  await expect(sheet.getByText("First row: Maria Delgado")).toBeVisible();

  // Readable date + swap toggles it.
  const dateSample = sheet.getByText(/First row: 03\/04\/2027 2:00 PM → /);
  await expect(dateSample).toBeVisible();
  const before = (await dateSample.innerText()).trim();
  await sheet.getByRole("button", { name: "Swap day and month" }).click();
  await expect(dateSample).not.toHaveText(before);
  console.log(`date sample: "${before}" -> "${(await dateSample.innerText()).trim()}"`);

  // Title is optional now: Continue enabled without a title column.
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled();
  await page.screenshot({ path: path.join(SHOTS, "a-map-1280.png"), fullPage: false });

  // Dropdown near the bottom of the sheet must fit on screen.
  await sheet.getByRole("button", { name: /Re-importing a Gallurio export/ }).click();
  await checkLastPickerFits(page, "a-1280");

  // Resize: drag the left edge 200px outward, then keyboard.
  const handle = page.getByRole("separator", { name: "Resize panel" });
  await expect(handle).toBeVisible();
  const w0 = await sheetWidth(page);
  const hb = (await handle.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(hb.x + hb.width / 2 - i * 20, hb.y + hb.height / 2);
  }
  await page.mouse.up();
  const w1 = await sheetWidth(page);
  console.log(`resize drag: ${w0} -> ${w1}`);
  expect(w1).toBeGreaterThan(w0 + 150);
  const cursor = await handle.evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe("col-resize");
  expect(await page.evaluate(() => document.body.style.userSelect)).not.toBe("none");
  await handle.focus();
  await page.keyboard.press("ArrowRight");
  const w2 = await sheetWidth(page);
  expect(Math.round(w1 - w2)).toBe(32);

  // Combine: + on a combinable field adds a slot, x removes it.
  const titleCard = sheet.locator("div.bg-card", { has: page.locator("#map-locationAddress") });
  await titleCard.getByRole("button", { name: "Combine with another column" }).click();
  await expect(titleCard.locator('[data-slot="select-trigger"]')).toHaveCount(2);
  await titleCard.getByRole("button", { name: "Remove this column" }).click();
  await expect(titleCard.locator('[data-slot="select-trigger"]')).toHaveCount(1);

  // Through the value step (if any) to the preview.
  await page.getByRole("button", { name: "Continue" }).click();
  if (await page.getByText("Match your values to ours").isVisible().catch(() => false)) {
    await page.screenshot({ path: path.join(SHOTS, "a-values-1280.png") });
    await page.getByRole("button", { name: "Continue" }).click();
  }
  await expect(sheet.locator("table")).toBeVisible();
  await expect(sheet.getByRole("button", { name: /1 skipped/ })).toBeVisible();
  const notesBtn = sheet.getByRole("button", { name: /with notes/ });
  await expect(notesBtn).toBeVisible();
  console.log(`counts: ${(await sheet.locator("table").locator("xpath=preceding::div[1]").innerText().catch(() => "")).replace(/\s+/g, " ")}`);
  await page.screenshot({ path: path.join(SHOTS, "a-preview-1280.png") });
  // No raw ISO strings in the start column.
  await expect(sheet.locator("table tbody")).not.toContainText(/\d{4}-\d{2}-\d{2}T/);
  // Notes open the dialog (not hover-only).
  await notesBtn.click();
  const notesDialog = page.getByRole("dialog").last();
  await expect(notesDialog).toContainText("left blank");
  await page.screenshot({ path: path.join(SHOTS, "a-notes-dialog-1280.png") });
  await page.keyboard.press("Escape");
  // Vocabulary is per-workspace ("appointments" in the seed), so match the count only.
  await expect(page.getByRole("button", { name: /^Import \d+ / })).toBeEnabled();

  // Width persists across close/reopen.
  await page.keyboard.press("Escape");
  await expect(page.locator(SHEET)).toHaveCount(0);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.locator(SHEET)).toBeVisible();
  expect(Math.abs((await sheetWidth(page)) - w2)).toBeLessThan(2);

  // Phone: full width, no handle, pickers fit.
  await page.setViewportSize({ width: 375, height: 740 });
  await expect(page.getByRole("separator", { name: "Resize panel" })).toBeHidden();
  expect(Math.round(await sheetWidth(page))).toBeGreaterThanOrEqual(373);
  await page.locator('input[type="file"]').setInputFiles(MESSY_CSV);
  await expect(page.getByText("Match your columns to ours")).toBeVisible();
  const noOverflow = await page.locator(SHEET).evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
  expect(noOverflow).toBe(true);
  await checkLastPickerFits(page, "a-375");
  await page.screenshot({ path: path.join(SHOTS, "a-map-375.png") });
});

test("Run C - ar RTL: handle stays on the sheet's left edge, nothing overflows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/ar/bookings");
  await page.getByRole("button", { name: "استيراد" }).click();
  await expect(page.locator(SHEET)).toBeVisible();
  await page.locator('input[type="file"]').setInputFiles(MESSY_CSV);
  await expect(page.locator(`${SHEET} h3`).first()).toBeVisible();
  const sheetBox = (await page.locator(SHEET).boundingBox())!;
  const handle = page.locator(`${SHEET} [role="separator"]`);
  const hb = (await handle.boundingBox())!;
  expect(Math.abs(hb.x - sheetBox.x)).toBeLessThan(10);
  expect(sheetBox.x + sheetBox.width).toBeLessThanOrEqual(1281);
  expect(await page.locator(SHEET).evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  const sample = page.locator(SHEET).getByText(/03\/04\/2027/).first();
  await expect(sample).toBeVisible();
  console.log(`ar date sample: ${(await sample.innerText()).trim()}`);
  await page.screenshot({ path: path.join(SHOTS, "c-ar-map-1280.png") });
});

test("Run B - invoice theme + export sheet: tiles, expand, resize, dark", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bookings");

  // Export sheet resizes too.
  await page.getByRole("button", { name: "Export", exact: true }).click();
  await expect(page.locator(SHEET)).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize panel" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(SHEET)).toHaveCount(0);

  await page.getByRole("button", { name: "Invoice & Receipt Theme" }).click();
  const sheet = page.locator(SHEET);
  await expect(sheet).toBeVisible();
  await expect(page.getByRole("separator", { name: "Resize panel" })).toBeVisible();

  for (const name of ["Match my portfolio", "Minimal", "Editorial", "Luxury", "Bold", "Romantic", "Modern", "Custom"]) {
    await expect(sheet.getByRole("button", { name: new RegExp(name) }).first()).toBeVisible();
  }
  const portfolioTile = sheet.getByRole("button", { name: /Match my portfolio/ });
  console.log(`portfolio tile disabled: ${await portfolioTile.isDisabled()}`);

  // Band text contrast on a dark and a light kit.
  for (const preset of ["Luxury", "Romantic", "Minimal"]) {
    await sheet.getByRole("button", { name: new RegExp(`^${preset}`) }).click();
    const header = sheet.locator("article header").first();
    const colors = await header.evaluate((el) => {
      const cs = getComputedStyle(el);
      const name = el.querySelector("span.truncate") as HTMLElement | null;
      return { bg: cs.backgroundColor, fg: name ? getComputedStyle(name).color : cs.color };
    });
    console.log(`${preset} band: ${JSON.stringify(colors)}`);
    expect(colors.fg).not.toBe(colors.bg);
  }
  await page.screenshot({ path: path.join(SHOTS, "b-theme-light-1280.png") });

  // Expand -> dark full-screen viewer; Esc closes; focus returns.
  const expand = sheet.getByRole("button", { name: "Expand preview" }).first();
  await expect(expand).toBeVisible();
  // The sheet goes aria-hidden under the viewer, so role counts are useless;
  // the viewer is the only thing wrapping its document in the scale box.
  const viewerDoc = page.locator("div.origin-top-left article");
  const viewer = viewerDoc.locator('xpath=ancestor::*[@role="dialog"][1]');
  await expand.click();
  await expect(viewerDoc).toBeVisible();
  await page.waitForTimeout(300);
  await expectInsideViewport(page, viewerDoc, "expanded document");
  const docBox = (await viewerDoc.boundingBox())!;
  expect(docBox.height).toBeGreaterThan(600);
  // The scrim must actually be dark (nested dialogs skip backdrops by default).
  const corner = await page.evaluate(() => {
    const el = document.elementFromPoint(5, window.innerHeight - 5) as HTMLElement | null;
    return el ? getComputedStyle(el).backgroundColor : null;
  });
  console.log(`scrim at corner: ${corner}`);
  // Chromium reports bg-black/90 as oklab, not rgb.
  expect(corner).toMatch(/^(rgba?\(0, 0, 0|oklab\(0 0 0)/);
  await page.screenshot({ path: path.join(SHOTS, "b-expanded-1280.png") });
  await page.keyboard.press("Escape");
  await expect(viewerDoc).toHaveCount(0);
  await expect(expand).toBeFocused();

  // Dark mode: expand button still visible against its surroundings.
  await page.evaluate(() => document.documentElement.classList.add("dark"));
  await sheet.getByRole("button", { name: /^Luxury/ }).click();
  await page.screenshot({ path: path.join(SHOTS, "b-theme-dark-1280.png") });
  await expand.click();
  await expect(viewerDoc).toBeVisible();
  const closeBtn = viewer.getByRole("button");
  await expect(closeBtn).toBeVisible();
  await page.screenshot({ path: path.join(SHOTS, "b-expanded-dark-1280.png") });
  await closeBtn.click();
  await expect(viewerDoc).toHaveCount(0);
  await expect(expand).toBeFocused();

  // Phone: full width, no handle.
  await page.setViewportSize({ width: 375, height: 740 });
  await expect(page.getByRole("separator", { name: "Resize panel" })).toBeHidden();
  expect(Math.round(await sheetWidth(page))).toBeGreaterThanOrEqual(373);
  await page.screenshot({ path: path.join(SHOTS, "b-theme-dark-375.png") });
  // DO NOT click "Save and apply".
});
