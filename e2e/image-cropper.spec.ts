import { test, expect, type Page } from "@playwright/test";
import path from "node:path";
import { openEditorWithDraft } from "./helpers";

// Drive-through for the shared crop-before-upload dialog. Uploads here hit the
// real dev workspace (wipeable dev DB) and real Cloudflare Images.

const REPO = path.resolve(__dirname, "..");
const WIDE_PHOTO = path.join(REPO, "public/marketing/screenshots/dashboard-overview-light.png");
const SECOND_PHOTO = path.join(REPO, "public/marketing/screenshots/bookings-calendar-light.png");
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
// same route, so their logo inputs must carry distinct DOM ids.
const WORKSPACE_LOGO_INPUT = "input#workspace-logoFile";
const HEADER_LOGO_INPUT = "input#public-page-logoFile";

/**
 * Records every Blob the page puts into a FormData. Chromium does not expose a
 * multipart file body to the network layer, so this is the only place we can
 * see what the uploader actually sends. Must be called before `page.goto`.
 */
async function captureUploadedBlobs(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __blobs: Blob[] };
    w.__blobs = [];
    const append = FormData.prototype.append;
    FormData.prototype.append = function (
      this: FormData,
      name: string,
      value: string | Blob,
      fileName?: string,
    ) {
      if (value instanceof Blob) w.__blobs.push(value);
      return fileName === undefined
        ? append.call(this, name, value as Blob)
        : append.call(this, name, value as Blob, fileName);
    } as typeof FormData.prototype.append;
  });
}

/** Resolves once the uploader has handed at least one blob to a FormData. */
async function waitForUploadedBlob(page: Page) {
  await expect
    .poll(
      async () => page.evaluate(() => (window as unknown as { __blobs: Blob[] }).__blobs.length),
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
}

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

  test("phone landscape: the footer buttons stay reachable", async ({ page }) => {
    // 390px tall is shorter than the dialog's natural height — without a
    // max-height + scroll region both ends clip off-screen and the modal traps
    // the user with Cancel and Upload unreachable.
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/settings/account");
    await page.getByRole("heading", { name: "Profile" }).waitFor({ timeout: 90_000 });
    await page.locator('input[type="file"]').first().setInputFiles(WIDE_PHOTO);

    const dialog = cropDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });

    for (const name of ["Cancel", "Upload"]) {
      const button = dialog.getByRole("button", { name, exact: true });
      const box = await button.boundingBox();
      expect(box, `${name} must be laid out`).not.toBeNull();
      expect(box!.y, `${name} must not clip off the top`).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height, `${name} must not clip off the bottom`).toBeLessThanOrEqual(390);
    }

    // Reachable means actually clickable, not merely painted.
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
  });

  test("avatar: a wide photo is uploaded as a square, capped at 512px", async ({ page }) => {
    await captureUploadedBlobs(page);

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

    // The source is a wide landscape screenshot; decode what actually went to
    // the uploader and prove the crop made it square and within the cap.
    const encoded = await page.evaluate(async () => {
      const blobs = (window as unknown as { __blobs: Blob[] }).__blobs;
      const blob = blobs.at(-1)!;
      const bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height, type: blob.type };
      bitmap.close();
      return dims;
    });
    expect(encoded.type).toBe("image/webp");
    expect(encoded.width, "avatar crop must be square").toBe(encoded.height);
    expect(encoded.width).toBeLessThanOrEqual(512);
  });

  test("an undecodable file surfaces an error instead of dead-ending", async ({ page }) => {
    await page.goto("/settings/account");
    await page.getByRole("heading", { name: "Profile" }).waitFor({ timeout: 90_000 });

    // File pickers derive MIME from the extension, so a non-image renamed .png
    // passes the hook's type check and only fails once the browser decodes it.
    await page.locator('input[type="file"]').first().setInputFiles({
      name: "not-really-an-image.png",
      mimeType: "image/png",
      buffer: Buffer.from("this is definitely not a PNG"),
    });

    const dialog = cropDialog(page);
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByRole("alert")).toContainText("couldn't be processed", {
      timeout: 15_000,
    });
    // Still escapable — the modal must not trap the user.
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
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

  test("settings routes render no duplicate DOM ids", async ({ page }) => {
    // Both the workspace form and the public-page form mount on each of these
    // routes; they used to share id="logoFile", which makes <label for>
    // ambiguous and silently points the wrong control at the wrong input.
    for (const route of ["/settings/workspace", "/settings/public-page"]) {
      await page.goto(route);
      await page.locator(WORKSPACE_LOGO_INPUT).waitFor({ state: "attached", timeout: 90_000 });

      const duplicates = await page.evaluate(() => {
        const seen = new Map<string, number>();
        for (const el of document.querySelectorAll("[id]")) {
          seen.set(el.id, (seen.get(el.id) ?? 0) + 1);
        }
        return [...seen.entries()].filter(([, n]) => n > 1).map(([id, n]) => `${id}×${n}`);
      });

      expect(duplicates, `${route} must not repeat a DOM id`).toEqual([]);
    }
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
    await expect(dialog).toContainText("keeps your image's proportions");
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

  test("public page: the OG upload is a 1.9:1 webp smaller than the source", async ({ page }) => {
    await captureUploadedBlobs(page);

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
    await waitForUploadedBlob(page);

    const encoded = await page.evaluate(async () => {
      const blob = (window as unknown as { __blobs: Blob[] }).__blobs.at(-1)!;
      const bitmap = await createImageBitmap(blob);
      const dims = { width: bitmap.width, height: bitmap.height, type: blob.type, size: blob.size };
      bitmap.close();
      return dims;
    });

    expect(encoded.type, "cropped blob must be re-encoded as webp").toBe("image/webp");
    expect(encoded.width).toBeLessThanOrEqual(1200);
    expect(encoded.height).toBeLessThanOrEqual(630);
    expect(encoded.width / encoded.height, "OG crop must hold 1.9:1").toBeCloseTo(1200 / 630, 1);
    // Source PNG is ~450 KB; the webp crop must come out smaller.
    expect(encoded.size, "cropped webp must be smaller than the source").toBeLessThan(450_000);
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

  test("portfolio gallery: bulk photo upload skips the crop dialog", async ({ page }) => {
    // Desktop-only surface — the portfolio editor is not a mobile-first flow.
    await page.setViewportSize({ width: 1280, height: 900 });
    await openEditorWithDraft(page, "Bold Template");

    await page.getByRole("button", { name: "Photos", exact: true }).click();
    // Dialog accessible names (not hasText substrings — "Add new collection"
    // would otherwise case-insensitively match a "New collection" filter too).
    const manager = page.getByRole("dialog", { name: "Photos & collections", exact: true });
    await expect(manager).toBeVisible({ timeout: 15_000 });

    // "New collection" hosts its own upload dropzone with a bulk file input —
    // reuse it without ever saving the collection, so the only side effect is
    // two Cloudflare asset uploads (no DB collection is created).
    await manager.getByRole("button", { name: "Add new collection" }).click();
    const create = page.getByRole("dialog", { name: "New collection", exact: true });
    await expect(create).toBeVisible({ timeout: 15_000 });

    const input = create.locator('input[type="file"]');
    await expect(input).toHaveAttribute("multiple", "");
    await input.setInputFiles([WIDE_PHOTO, SECOND_PHOTO]);

    // The crop dialog must never appear for this bulk path.
    await expect(cropDialog(page)).toBeHidden({ timeout: 5_000 });

    // Upload actually proceeds: both thumbnails land in the local preview list.
    await expect(create.getByRole("list", { name: "Uploaded photos" }).getByRole("listitem")).toHaveCount(2, {
      timeout: 60_000,
    });

    await create.getByRole("button", { name: "Cancel" }).click();
    await expect(create).toBeHidden();
  });
});
