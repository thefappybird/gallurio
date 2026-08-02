import { test, expect, type Page } from "@playwright/test";
import path from "node:path";

// Drive-through for the shared crop-before-upload dialog. Uploads here hit the
// real dev workspace (wipeable dev DB) and real Cloudflare Images.

const REPO = path.resolve(__dirname, "..");
const WIDE_PHOTO = path.join(REPO, "public/marketing/screenshots/dashboard-overview-light.png");
const SMALL_SVG = path.join(REPO, "public/file.svg");
const WORDMARK = path.join(REPO, "public/brand/gallurio rect.png");

const BREAKPOINTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1280, height: 900 },
] as const;

function cropDialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Crop image" });
}

// The settings shell renders the workspace form and the public-page form on the
// same route, and both ship an input with id="logoFile" (pre-existing duplicate
// DOM id, not introduced here). Disambiguate on `accept`: only the workspace
// logo takes SVG.
const WORKSPACE_LOGO_INPUT = 'input#logoFile[accept*="svg"]';
const HEADER_LOGO_INPUT = 'input#logoFile:not([accept*="svg"])';

/** Fails if the page scrolls horizontally — the mobile-first guard. */
async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "page must not scroll horizontally").toBeLessThanOrEqual(1);
}

test.describe("image cropper", () => {
  for (const bp of BREAKPOINTS) {
    test(`avatar: 1:1 round crop renders at ${bp.name} (${bp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto("/settings/account");
      await page.getByRole("heading", { name: "Profile" }).waitFor({ timeout: 90_000 });

      await page.locator('input[type="file"]').first().setInputFiles(WIDE_PHOTO);

      const dialog = cropDialog(page);
      await expect(dialog).toBeVisible({ timeout: 15_000 });
      // avatar spec: aspect 1 -> "1:1", caps 512x512
      await expect(dialog).toContainText("Frame your image at 1:1");
      await expect(dialog).toContainText("512×512");
      await expect(dialog.getByLabel("Zoom")).toBeVisible();
      // round overlay for the avatar surface
      await expect(dialog.locator(".reactEasyCrop_CropAreaRound")).toBeVisible();
      await expectNoHorizontalScroll(page);
      await page.screenshot({ path: `e2e/__screenshots__/cropper-avatar-${bp.name}.png` });

      const upload = dialog.getByRole("button", { name: "Upload", exact: true });
      await expect(upload).toBeEnabled({ timeout: 10_000 });
      await dialog.getByRole("button", { name: "Cancel" }).click();
      await expect(dialog).toBeHidden();
    });
  }

  test("avatar: upload encodes the crop and saves", async ({ page }) => {
    await page.goto("/settings/account");
    await page.getByRole("heading", { name: "Profile" }).waitFor({ timeout: 90_000 });
    await page.locator('input[type="file"]').first().setInputFiles(WIDE_PHOTO);

    const dialog = cropDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    const upload = dialog.getByRole("button", { name: "Upload", exact: true });
    await expect(upload).toBeEnabled({ timeout: 10_000 });
    await upload.click();

    await expect(dialog).toBeHidden({ timeout: 60_000 });
    await expect(page.getByText("Photo updated")).toBeVisible({ timeout: 60_000 });
  });

  test("zoom slider is keyboard operable and changes zoom", async ({ page }) => {
    await page.goto("/settings/account");
    await page.getByRole("heading", { name: "Profile" }).waitFor({ timeout: 90_000 });
    await page.locator('input[type="file"]').first().setInputFiles(WIDE_PHOTO);

    const dialog = cropDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    const zoom = dialog.getByLabel("Zoom");
    await expect(zoom).toHaveValue("1");
    await zoom.focus();
    await zoom.press("ArrowRight");
    await expect(zoom).not.toHaveValue("1");

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("cancel closes without uploading and the same file can be re-picked", async ({ page }) => {
    const uploads: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/api/images/direct-upload")) uploads.push(r.url());
    });

    await page.goto("/settings/account");
    await page.getByRole("heading", { name: "Profile" }).waitFor({ timeout: 90_000 });
    const input = page.locator('input[type="file"]').first();

    await input.setInputFiles(WIDE_PHOTO);
    const dialog = cropDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(uploads, "cancel must not fire an upload").toHaveLength(0);

    // Same file again — proves the input value was reset on the cancel path.
    await input.setInputFiles(WIDE_PHOTO);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect(uploads).toHaveLength(0);
  });

  test("workspace logo: SVG bypasses the cropper entirely", async ({ page }) => {
    await page.goto("/settings/workspace");
    await page.locator(WORKSPACE_LOGO_INPUT).waitFor({ state: "attached", timeout: 90_000 });
    await page.locator(WORKSPACE_LOGO_INPUT).setInputFiles(SMALL_SVG);

    // No modal at all — vector passes straight through to the uploader.
    await expect(cropDialog(page)).toBeHidden({ timeout: 5_000 });
    await expect(page.locator('img[src*="imagedelivery"]').first()).toBeVisible({ timeout: 60_000 });
    await expect(cropDialog(page)).toBeHidden();
  });

  test("workspace logo: raster opens a 1:1 crop", async ({ page }) => {
    await page.goto("/settings/workspace");
    await page.locator(WORKSPACE_LOGO_INPUT).waitFor({ state: "attached", timeout: 90_000 });
    await page.locator(WORKSPACE_LOGO_INPUT).setInputFiles(WORDMARK);

    const dialog = cropDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toContainText("Frame your image at 1:1");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("public page: header logo is free-aspect, OG image is locked to 1.9:1", async ({ page }) => {
    await page.goto("/settings/public-page");
    await page.locator(HEADER_LOGO_INPUT).waitFor({ state: "attached", timeout: 90_000 });

    await page.locator(HEADER_LOGO_INPUT).setInputFiles(WORDMARK);
    const dialog = cropDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toContainText("any shape works");
    await expect(dialog).toContainText("1024×512");
    // free-aspect surfaces must NOT get the round overlay
    await expect(dialog.locator(".reactEasyCrop_CropAreaRound")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await page.locator("#ogImageFile").setInputFiles(WIDE_PHOTO);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog).toContainText("Frame your image at 1.9:1");
    await expect(dialog).toContainText("1200×630");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("public page: the uploaded blob is re-encoded as image/webp", async ({ page }) => {
    // Chromium does not expose a multipart file body to the network layer, so
    // record what the uploader actually puts on the wire at the FormData seam.
    await page.addInitScript(() => {
      const w = window as unknown as { __blobs: { type: string; size: number }[] };
      w.__blobs = [];
      const append = FormData.prototype.append;
      FormData.prototype.append = function (
        this: FormData,
        name: string,
        value: string | Blob,
        fileName?: string,
      ) {
        if (value instanceof Blob) w.__blobs.push({ type: value.type, size: value.size });
        return fileName === undefined
          ? append.call(this, name, value as Blob)
          : append.call(this, name, value as Blob, fileName);
      } as typeof FormData.prototype.append;
    });

    await page.goto("/settings/public-page");
    await page.locator("#ogImageFile").waitFor({ state: "attached", timeout: 90_000 });
    await page.locator("#ogImageFile").setInputFiles(WIDE_PHOTO);

    const dialog = cropDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    const upload = dialog.getByRole("button", { name: "Upload", exact: true });
    await expect(upload).toBeEnabled({ timeout: 10_000 });
    await upload.click();
    await expect(dialog).toBeHidden({ timeout: 60_000 });

    // The dialog closes as soon as the crop is encoded — the upload runs after.
    const readBlobs = () =>
      page.evaluate(() => (window as unknown as { __blobs: { type: string; size: number }[] }).__blobs);
    await expect
      .poll(async () => (await readBlobs()).length, { timeout: 60_000 })
      .toBeGreaterThan(0);

    const uploaded = (await readBlobs()).at(-1);
    expect(uploaded, "an image blob must have been uploaded").toBeTruthy();
    expect(uploaded!.type, "cropped blob must be re-encoded as webp").toBe("image/webp");
    // Source PNG is ~450 KB; the 1200x630 webp crop must come out smaller.
    expect(uploaded!.size, "cropped webp must be smaller than the source").toBeLessThan(450_000);
  });

  test("arabic: chrome flips RTL but the crop surface stays LTR", async ({ page }) => {
    await page.goto("/ar/settings/account");
    await page.locator('input[type="file"]').first().waitFor({ state: "attached", timeout: 90_000 });
    await page.locator('input[type="file"]').first().setInputFiles(WIDE_PHOTO);

    const dialog = page.getByRole("dialog").first();
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    // The cropper canvas must not mirror, or drag direction inverts.
    await expect(dialog.locator('div[dir="ltr"]').first()).toBeVisible();
    await page.screenshot({ path: "e2e/__screenshots__/cropper-arabic.png" });

    await dialog.getByRole("button", { name: "إلغاء" }).click();
    await expect(dialog).toBeHidden();
  });
});
