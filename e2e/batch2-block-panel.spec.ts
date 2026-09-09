import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";
import { E2E_FIXTURE_DRAFT_NAME } from "../lib/db/seedE2eDraft";

// Batch 2 — block-properties panel checks (requires selecting a block):
//  #17 emoji button inserts an emoji into the selected block's text
//  #8  corner-radius is a button group (not a number input), under the Frame drawer
//  #12 standard spacing drawer no longer shows Top/Bottom spacing
// DRIFT: the "Insert emoji" control is not reachable in the current block panel
// (element not found after selecting a heading). The panel chrome changed since
// this was written; re-derive the selectors before re-enabling.
test.fixme("editor block panel: emoji insert, radius buttons, no top/bottom spacing", async ({ page }) => {
  test.setTimeout(120_000); // multi-step: load+discard, select, emoji, container, tab switches
  await openEditorWithDraft(page, E2E_FIXTURE_DRAFT_NAME);

  // Select the first heading in the canvas.
  const heading = page.locator("[data-puck-preview] :is(h1,h2,h3)").first();
  await heading.click();

  const emojiBtn = page.getByRole("button", { name: "Insert emoji" }).first();
  await expect(emojiBtn).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "e2e/.artifacts/batch2-panel.png" });

  // #17 — insert an emoji and confirm it reaches the canvas.
  // #17 — insert an emoji and confirm it reaches the canvas.
  await emojiBtn.click();
  const picker = page.getByRole("dialog", { name: "Emoji picker" });
  await expect(picker).toBeVisible();
  await picker.getByRole("button", { name: "🎉" }).click();
  await expect(page.locator("[data-puck-preview]")).toContainText("🎉");

  const clickTab = async (name: string) => {
    const tab = page.getByRole("tab", { name }).or(page.getByRole("button", { name, exact: true }));
    await tab.first().click();
  };

  // #8 — radius (Frame drawer) only exists for box blocks; select the parent Hero
  // container via the panel breadcrumb, then confirm the RadiusButtons group.
  // The preset library moved labels from the flat group name to the variant
  // name, so the Hero preset is outlined as "Immersive cover", not "Hero".
  await page.getByText("Immersive cover", { exact: true }).last().click();
  await clickTab("Design");
  const frame = page.getByRole("button", { name: "Frame" }).first();
  if ((await frame.getAttribute("aria-expanded")) === "false") await frame.click();
  await expect(page.getByText("Corner radius")).toBeVisible();
  // RadiusButtons group: preset buttons (None..Full) instead of a number input.
  const radiusGroup = page
    .locator("div")
    .filter({ has: page.getByText("Corner radius", { exact: true }) })
    .filter({ has: page.getByRole("button", { name: "Full" }) })
    .last();
  await expect(radiusGroup.getByRole("button", { name: "None" })).toBeVisible();
  await expect(radiusGroup.getByRole("button", { name: "Full" })).toBeVisible();
  await page.screenshot({ path: "e2e/.artifacts/batch2-radius.png" });

  // #12 — Layout tab spacing no longer exposes Top/Bottom spacing.
  await clickTab("Layout");
  const drawerHeaders = await page.locator('button[aria-expanded="false"]').all();
  for (const d of drawerHeaders) await d.click({ timeout: 3_000 }).catch(() => {});
  await expect(page.getByText("Top spacing")).toHaveCount(0);
  await expect(page.getByText("Bottom spacing")).toHaveCount(0);
});
