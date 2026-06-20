import { type Page, expect } from "@playwright/test";

// Shared portfolio-editor drivers reused across batch verification specs.
// The seeded owner has saved drafts (item #23: "new draft 2" holds every block),
// so the entry dialog opens in "returning user" mode.

/** Open the portfolio editor and load a saved draft by name onto the canvas. */
export async function openEditorWithDraft(page: Page, draftName: string): Promise<void> {
  await page.goto("/portfolio");
  await page.locator("[data-testid='portfolio-editor-shell']").waitFor({ timeout: 90_000 });

  // The entry dialog mounts a beat after the shell hydrates — wait for it.
  const load = page.getByRole("button", { name: /load an existing draft/i });
  await load.waitFor({ state: "visible", timeout: 30_000 });
  await load.click();
  const apply = page.getByRole("button", { name: new RegExp(`^Apply ${draftName}$`, "i") });
  await apply.waitFor({ state: "visible", timeout: 15_000 });
  await apply.click();
  // The editor boots the latest draft as dirty, so switching surfaces an
  // unsaved-changes guard — discard it to load the saved draft cleanly.
  const discard = page.getByRole("button", { name: /^Discard$/ });
  if (await discard.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await discard.click();
  }
  // Entry + drafts dialogs close; canvas reflows.
  await page.getByText("Welcome back").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await page.getByText("Your drafts").waitFor({ state: "hidden", timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1_500);
}

/** Publish the currently-loaded draft. Returns the public URL shown in the dialog. */
export async function publishCurrent(page: Page): Promise<string> {
  await page.getByRole("button", { name: /^Publish$/ }).first().click();
  const dialog = page.getByRole("dialog").filter({ hasText: "Publish your portfolio?" });
  await expect(dialog).toBeVisible();
  const url = (await dialog.locator("span.truncate").first().innerText()).trim();
  await dialog.getByRole("button", { name: "Publish now" }).click();
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  return url;
}
