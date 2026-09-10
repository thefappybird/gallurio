import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";
import { E2E_FIXTURE_DRAFT_NAME } from "../lib/db/seedE2eDraft";

// Batch 2 — editor-global checks:
//  #25 Undo/Redo buttons present; Undo disabled with no history
//  #16 canvas text-isolation rule ([data-puck-preview]{color:var(--foreground)}) injected
// DRIFT: Undo/Redo are no longer top-level toolbar buttons at 1280px — they sit
// behind an "Editor controls" overflow menu (confirmed: the page renders that
// button, no dialog, editor fully loaded). The rewrite must open that menu first
// or run at a width where the toolbar is not collapsed.
test.fixme("editor: undo/redo affordance + canvas text isolation rule present", async ({ page }) => {
  await openEditorWithDraft(page, E2E_FIXTURE_DRAFT_NAME);

  const undo = page.getByRole("button", { name: "Undo" });
  const redo = page.getByRole("button", { name: "Redo" });
  await expect(undo).toBeVisible();
  await expect(redo).toBeVisible();
  await expect(undo).toBeDisabled(); // fresh load -> no past history

  const isolated = await page.evaluate(() =>
    Array.from(document.querySelectorAll("style")).some((s) => {
      const t = s.textContent ?? "";
      return t.includes("[data-puck-preview]") && t.includes("var(--foreground)");
    }),
  );
  console.log("[diag] canvas isolation rule present:", isolated);
  expect(isolated, "canvas text isolation rule injected").toBe(true);

  await page.screenshot({ path: "e2e/.artifacts/batch2-editor.png" });
});
