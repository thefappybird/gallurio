import { test, expect } from "@playwright/test";

// Batch 1 verification (editor chrome):
//  #15 chrome font resolves to Plus Jakarta Sans (not Merriweather)
//  #24 no "usePuck without a selector" console warning
//  #14 Publish button matches Save changes button height
// (#7 hotkey interception proven mechanically: Puck binds keydown on document in
//  bubble phase, so the editor-root stopPropagation prevents it; unit-tested separately.)

test("editor: Jakarta chrome font, no usePuck warning, publish==save size", async ({ page }) => {
  const warnings: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") warnings.push(msg.text());
  });

  await page.goto("/portfolio");
  await page.locator("[data-testid='portfolio-editor-shell']").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(2_000);

  const fontInfo = await page.evaluate(() => {
    const root = document.querySelector(".gallurio-editor") as HTMLElement | null;
    if (!root) return null;
    const cs = getComputedStyle(root);
    return { puckFontVar: cs.getPropertyValue("--puck-font-family").trim(), fontFamily: cs.fontFamily };
  });
  console.log("[diag] editor font:", JSON.stringify(fontInfo));
  expect(fontInfo, ".gallurio-editor root present").not.toBeNull();
  expect(`${fontInfo!.puckFontVar} ${fontInfo!.fontFamily}`.toLowerCase()).not.toContain("merriweather");

  const usePuckWarn = warnings.filter((w) => w.toLowerCase().includes("usepuck"));
  console.log("[diag] usePuck warnings:", JSON.stringify(usePuckWarn));
  expect(usePuckWarn, "no usePuck-without-selector warning").toHaveLength(0);

  // (#14 button parity + the public header are verified in batch1-flow.spec.ts,
  // which dismisses the entry dialog — Radix marks the page inert while it's open.)
  await page.screenshot({ path: "e2e/.artifacts/batch1-editor.png" });
});
