/**
 * One read-only browser pass for the permanent page body, drawer affordances,
 * repaired preset miniatures, and the compact active-draft treatment.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { E2E_FIXTURE_DRAFT_NAME } from "../lib/db/seedE2eDraft";
import { openEditorWithDraft } from "./helpers";

const SHELL = "[data-testid='portfolio-editor-shell']";
const ITEM_NAME = '[class*="_DrawerItem-name_"]';

async function hoverRow(page: Page, row: Locator): Promise<void> {
  await row.scrollIntoViewIfNeeded();
  const box = await row.boundingBox();
  if (!box) throw new Error("drawer row has no bounding box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
}

function drawerHeading(page: Page, name: string): Locator {
  return page
    .locator(`${SHELL} section > div > [role="button"]`)
    .filter({ hasText: new RegExp(`^${name}$`, "i") })
    .first();
}

async function expandDrawer(page: Page, name: string): Promise<void> {
  const heading = drawerHeading(page, name);
  await expect(heading).toBeVisible();
  if ((await heading.getAttribute("aria-expanded")) !== "true") await heading.click();
}

test("page body, component drawer, preset previews, and drafts stay coherent", async ({ page }) => {
  test.setTimeout(210_000);
  await page.setViewportSize({ width: 1280, height: 900 });
  await openEditorWithDraft(page, E2E_FIXTURE_DRAFT_NAME);

  const preview = page.locator("[data-puck-preview]");
  const rootDropZone = preview.locator('[data-puck-dropzone="root:default-zone"]');
  const pageBody = preview.locator('[data-block="page-body"]');
  await expect(pageBody).toHaveCount(1);
  await expect(pageBody.locator('[data-puck-dropzone$=":content"]')).toHaveCount(1);

  const bodyGeometry = await pageBody.evaluate((body) => {
    const bodyStyle = getComputedStyle(body);
    const slot = body.querySelector('[data-puck-dropzone$=":content"]') as HTMLElement | null;
    const root = body.closest('[data-puck-dropzone="root:default-zone"]') as HTMLElement | null;
    return {
      bodyWidth: body.getBoundingClientRect().width,
      previewWidth: (body.closest("[data-puck-preview]") as HTMLElement).getBoundingClientRect().width,
      frameDisplay: root ? getComputedStyle(root).display : "",
      frameDirection: root ? getComputedStyle(root).flexDirection : "",
      rootMinHeight: root ? parseFloat(getComputedStyle(root).minHeight) : 0,
      slotPaddingInline: slot ? [getComputedStyle(slot).paddingLeft, getComputedStyle(slot).paddingRight] : [],
    };
  });
  expect(bodyGeometry.bodyWidth).toBeCloseTo(bodyGeometry.previewWidth, 0);
  // Sticky-footer frame, now from the shared sheet (PF_PAGE_FRAME_CSS) so the
  // canvas, the preview and the public page all use one rule.
  expect(bodyGeometry.frameDisplay).toBe("flex");
  expect(bodyGeometry.frameDirection).toBe("column");
  expect(bodyGeometry.rootMinHeight).toBeGreaterThanOrEqual(899);
  expect(bodyGeometry.slotPaddingInline).toEqual(["24px", "24px"]);

  const structuralHeadings = page.locator(`${SHELL} section > div > [role="button"]:visible`);
  expect(await structuralHeadings.count()).toBeGreaterThan(3);
  expect(
    await structuralHeadings.evaluateAll((nodes) =>
      nodes.map((node) => ({ text: (node.textContent ?? "").trim(), cursor: getComputedStyle(node).cursor }))
    )
  ).toEqual(expect.arrayContaining([
    expect.objectContaining({ text: "Preset blocks", cursor: "pointer" }),
    expect.objectContaining({ text: "Footer", cursor: "pointer" }),
  ]));
  expect(await structuralHeadings.evaluateAll((nodes) => nodes.every((node) => getComputedStyle(node).cursor === "pointer"))).toBe(true);
  await expect(page.locator(ITEM_NAME).filter({ hasText: /^Page body$/i })).toHaveCount(0);

  const previewPanel = page.locator('[data-preset-preview-panel="true"]');
  for (const [group, preset] of [
    ["Footer", "Directory footer"],
    ["Footer", "Closing statement"],
    ["Gallery landing", "Split gallery intro"],
  ] as const) {
    await expandDrawer(page, group);
    await hoverRow(page, page.locator(ITEM_NAME).filter({ hasText: new RegExp(`^${preset}$`, "i") }).first());
    await expect(previewPanel).toContainText(preset);

    const bounds = await previewPanel.evaluate((panel) => {
      const frame = panel.querySelector('[aria-hidden="true"]') as HTMLElement | null;
      const inner = frame?.firstElementChild as HTMLElement | null;
      const section = inner?.querySelector('[data-block="container"]') as HTMLElement | null;
      if (!frame || !inner || !section) return null;
      const f = frame.getBoundingClientRect();
      const s = section.getBoundingClientRect();
      return { frameLeft: f.left, frameRight: f.right, sectionLeft: s.left, sectionRight: s.right };
    });
    expect(bounds, `${preset} renders a live section`).not.toBeNull();
    expect(bounds!.sectionLeft, `${preset} does not spill left`).toBeGreaterThanOrEqual(bounds!.frameLeft - 1);
    expect(bounds!.sectionRight, `${preset} does not spill right`).toBeLessThanOrEqual(bounds!.frameRight + 1);
  }

  await page.getByRole("button", { name: /^Drafts$/ }).click();
  const drafts = page.getByRole("dialog").filter({ hasText: "Your drafts" });
  await expect(drafts).toBeVisible();
  await expect(drafts.getByText(/^Active$/i)).toHaveCount(0);

  const activeCard = drafts.locator("li").filter({ hasText: E2E_FIXTURE_DRAFT_NAME });
  await expect(activeCard).toHaveCount(1);
  expect(await activeCard.evaluate((card) => getComputedStyle(card).borderTopWidth)).toBe("2px");
  await expect(activeCard.getByRole("button", { name: new RegExp(`^Apply ${E2E_FIXTURE_DRAFT_NAME}$`, "i") })).toHaveCount(0);
  expect(await drafts.getByRole("button", { name: /^Apply /i }).count()).toBeGreaterThan(0);

  // Keep the explicit locator alive through the end of the pass; it also
  // proves the root PageBody did not remount away while the drawers changed.
  await expect(rootDropZone).toHaveCount(1);
});
