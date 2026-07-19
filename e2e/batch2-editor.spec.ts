import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

// Batch 2 — editor-global checks:
//  #25 Undo/Redo buttons present; Undo disabled with no history
//  #16 canvas text-isolation rule ([data-puck-preview]{color:var(--foreground)}) injected
test("editor: undo/redo affordance + canvas text isolation rule present", async ({ page }) => {
  await openEditorWithDraft(page, "new draft 2");

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
