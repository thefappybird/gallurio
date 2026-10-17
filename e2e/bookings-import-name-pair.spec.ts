import path from "node:path";
import { test, expect } from "@playwright/test";

/**
 * Import auto-mapping and preview dates: an "Event Name" column must not stop
 * First + Last Name pairing, and the preview shows a time only for cells that
 * had one (including "noon" and "9.30pm"). Nothing is submitted.
 */

const CSV = path.join(__dirname, "fixtures", "bookings-name-pair.csv");
const SHEET = '[data-slot="sheet-content"]';
const SHOTS = path.join(__dirname, ".artifacts", "import-name-pair");

test("import: name pair beside Event Name, preview times follow the source cell", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/bookings");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles(CSV);
  // Every column maps on its own (First + Last paired, Event Name as title), so
  // the sheet skips straight to the preview.
  const sheet = page.locator(SHEET);
  await expect(sheet.getByText("Columns matched automatically")).toBeVisible();
  await expect(sheet.locator("table")).toBeVisible();
  const row = (client: string) => sheet.locator("table tbody tr", { hasText: client });
  await expect(row("Ana Cruz")).toContainText("Garden Wedding");

  // Columns: #, status, title, client, start.
  const startCell = (client: string) => row(client).locator("td").nth(4);
  const dateOnly = (await startCell("Ana Cruz").innerText()).trim();
  const noon = (await startCell("Ben Reyes").innerText()).trim();
  const evening = (await startCell("Cara Lim").innerText()).trim();
  console.log(`start cells: "${dateOnly}" | "${noon}" | "${evening}"`);

  expect(dateOnly).toMatch(/2027/);
  expect(dateOnly).not.toMatch(/\d:\d{2}/);
  expect(noon).toMatch(/12:00/);
  expect(evening).toMatch(/9:30/);
  await page.screenshot({ path: path.join(SHOTS, "preview-1280.png") });
  // DO NOT click the import button.
});
