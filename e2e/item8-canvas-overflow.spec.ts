import { test, expect } from "@playwright/test";

/**
 * Item 8 — Canvas overflow: page grows to fit content.
 *
 * Verifies that the editor canvas page surface ([data-puck-preview]) grows to
 * contain tall blocks (min-height: Xvh) instead of clipping them at the
 * viewport height. The fix lives in RootCanvasStyle.tsx (min-height: fit-content).
 */

test.describe("Item 8 — canvas page grows to fit tall content", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/portfolio");
    await page.locator("[data-testid='portfolio-editor-shell']").waitFor({
      timeout: 90_000,
    });
    // Wait for the canvas style injected by RootCanvasStyle to include the growth rule.
    await page.waitForFunction(
      () => {
        const style = document.getElementById("pf-root-canvas-style");
        return style && style.textContent && style.textContent.includes("min-height");
      },
      { timeout: 15_000 },
    );
  });

  test("canvas surface grows beyond viewport when a tall block is present (desktop 1280px)", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    // Inject a tall sentinel div directly into [data-puck-preview] to simulate
    // a block with min-height:100vh.
    await page.evaluate(() => {
      const preview = document.querySelector("[data-puck-preview]") as HTMLElement | null;
      if (!preview) throw new Error("[data-puck-preview] not found");
      const sentinel = document.createElement("div");
      sentinel.id = "pf-overflow-sentinel";
      sentinel.style.cssText = "min-height: 200vh; background: rgba(255,0,0,0.1);";
      preview.appendChild(sentinel);
    });

    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const preview = document.querySelector("[data-puck-preview]") as HTMLElement | null;
      if (!preview) return null;
      return {
        scrollHeight: preview.scrollHeight,
        clientHeight: preview.clientHeight,
        viewportHeight: window.innerHeight,
        computedMinHeight: getComputedStyle(preview).minHeight,
      };
    });

    console.log("[item8-desktop] metrics:", JSON.stringify(metrics));
    expect(metrics, "[data-puck-preview] must exist").not.toBeNull();

    // The canvas surface scrollHeight must exceed the viewport height because
    // the sentinel is 200vh tall and min-height: fit-content allows growth.
    expect(metrics!.scrollHeight).toBeGreaterThan(metrics!.viewportHeight);

    // Confirm the computed min-height is fit-content (not auto or 0px).
    expect(metrics!.computedMinHeight).toMatch(/fit-content/);

    await page.screenshot({
      path: "e2e/.artifacts/item8-canvas-overflow-desktop.png",
      fullPage: false,
    });
  });

  test("canvas surface grows beyond viewport at 375px mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.evaluate(() => {
      const preview = document.querySelector("[data-puck-preview]") as HTMLElement | null;
      if (!preview) throw new Error("[data-puck-preview] not found");
      const sentinel = document.createElement("div");
      sentinel.id = "pf-overflow-sentinel";
      sentinel.style.cssText = "min-height: 200vh; background: rgba(255,0,0,0.1);";
      preview.appendChild(sentinel);
    });

    await page.waitForTimeout(300);

    const metrics = await page.evaluate(() => {
      const preview = document.querySelector("[data-puck-preview]") as HTMLElement | null;
      if (!preview) return null;
      return {
        scrollHeight: preview.scrollHeight,
        clientHeight: preview.clientHeight,
        viewportHeight: window.innerHeight,
        computedMinHeight: getComputedStyle(preview).minHeight,
      };
    });

    console.log("[item8-mobile] metrics:", JSON.stringify(metrics));
    expect(metrics, "[data-puck-preview] must exist").not.toBeNull();
    expect(metrics!.scrollHeight).toBeGreaterThan(metrics!.viewportHeight);
    expect(metrics!.computedMinHeight).toMatch(/fit-content/);

    await page.screenshot({
      path: "e2e/.artifacts/item8-canvas-overflow-mobile-375.png",
      fullPage: false,
    });
  });
});
