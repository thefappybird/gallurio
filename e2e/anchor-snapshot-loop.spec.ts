import { test, expect } from "@playwright/test";
import { openEditorWithDraft } from "./helpers";

// Regression: EditorContainerAnchor's usePuckStore selector built a fresh
// object per call, so useSyncExternalStore saw a new snapshot every read and
// the editor died with "Maximum update depth exceeded" on load.
test("portfolio editor loads a container draft without a getSnapshot render loop", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await openEditorWithDraft(page, "Luxury Template");

  // The template's Containers hold ordinary children -> the anchor's "fill" branch.
  await expect(page.locator(".pf-container-anchor").first()).toBeAttached();

  const loops = errors.filter((e) =>
    /Maximum update depth exceeded|getSnapshot should be cached/i.test(e),
  );
  expect(loops, `render-loop errors:\n${loops.join("\n")}`).toEqual([]);
});
