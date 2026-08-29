import { test, expect } from "@playwright/test";
import { openEditorWithDraft, publishCurrent } from "./helpers";

// Batch 1 end-to-end flow:
//  #14 Publish button matches Save changes button height (in the live editor)
//  #1  public mobile header toggle inherits Contact button fill (375px)
//  #2  public mobile drawer nav links are centered (375px)
// Loads a real design draft (NOT the structural E2E fixture — this publishes,
// and the assertions need a designed page) and publishes it so the public
// page renders, then inspects the mobile header.

test("publish a design draft then verify button parity + public mobile header (375px)", async ({ page }) => {
  await openEditorWithDraft(page, "Editorial Summer Refresh");

  // #14 — Save changes and Publish share the same height now that the dialog is gone.
  const save = page.getByRole("button", { name: "Save changes" }).first();
  const publish = page.getByRole("button", { name: /^Publish$/ }).first();
  const sb = await save.boundingBox();
  const pb = await publish.boundingBox();
  console.log("[diag] save:", JSON.stringify(sb), "publish:", JSON.stringify(pb));
  expect(sb, "save button present").not.toBeNull();
  expect(pb, "publish button present").not.toBeNull();
  expect(Math.abs(sb!.height - pb!.height)).toBeLessThanOrEqual(1);

  const url = await publishCurrent(page);
  console.log("[diag] published url:", url);
  const path = url.replace(/^https?:\/\/[^/]+/, "");

  // Public mobile header at 375px.
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(path);
  await page.waitForLoadState("networkidle");

  const toggle = page.locator(".pf-nav-toggle");
  await expect(toggle).toBeVisible();
  const bg = await toggle.evaluate((el) => getComputedStyle(el).backgroundColor);
  console.log("[diag] toggle bg:", bg);
  expect(bg).not.toBe("rgba(0, 0, 0, 0)");
  expect(bg).not.toBe("transparent");

  await toggle.click();
  const link = page.locator(".pf-nav-mobile .pf-nav-link").first();
  await expect(link).toBeVisible();
  const justify = await link.evaluate((el) => getComputedStyle(el).justifyContent);
  console.log("[diag] drawer link justifyContent:", justify);
  expect(justify).toBe("center");

  await page.screenshot({ path: "e2e/.artifacts/batch1-public-375.png", fullPage: true });
});
