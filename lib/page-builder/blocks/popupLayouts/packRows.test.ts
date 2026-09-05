import { describe, it, expect } from "vitest";
import { packRows, DEFAULT_TARGET_HEIGHT, type PackableImage } from "./packRows";

const img = (width: number, height: number): PackableImage => ({ width, height });

/** Total rendered width of a row, gutters included — must fill the container. */
function rowWidth(items: { width: number }[], gutter: number): number {
  return items.reduce((a, i) => a + i.width, 0) + gutter * Math.max(0, items.length - 1);
}

const OPTS = { containerWidth: 1000, targetHeight: 250, gutter: 8 };

describe("packRows", () => {
  it("returns nothing for an empty list", () => {
    expect(packRows([], OPTS)).toEqual([]);
  });

  it("returns nothing when the container has no width", () => {
    expect(packRows([img(4, 3)], { ...OPTS, containerWidth: 0 })).toEqual([]);
  });

  it("fills the container width exactly on every stretched row", () => {
    const images = Array.from({ length: 20 }, (_, i) => img([4, 3, 16, 2][i % 4], [3, 4, 9, 3][i % 4]));
    const rows = packRows(images, OPTS);
    // Every row but the last is stretched to fill.
    for (const row of rows.slice(0, -1)) {
      expect(rowWidth(row.items, OPTS.gutter)).toBeCloseTo(OPTS.containerWidth, 5);
    }
  });

  it("keeps every stretched row's height near the target", () => {
    const images = Array.from({ length: 24 }, (_, i) => img([4, 3, 16, 2, 1][i % 5], [3, 4, 9, 3, 1][i % 5]));
    const rows = packRows(images, OPTS);
    for (const row of rows.slice(0, -1)) {
      // This is the property the naive "break as soon as you fit" packer fails:
      // it produces towering two-image rows next to short five-image ones.
      expect(row.height).toBeGreaterThan(OPTS.targetHeight * 0.6);
      expect(row.height).toBeLessThan(OPTS.targetHeight * 1.6);
    }
  });

  it("preserves each image's aspect ratio", () => {
    const rows = packRows([img(16, 9), img(3, 4), img(1, 1), img(4, 3), img(2, 3)], OPTS);
    const flat = rows.flatMap((r) => r.items.map((i) => ({ ...i, height: r.height })));
    expect(flat).toHaveLength(5);
    for (const { item, width, height } of flat) {
      const expected = (item.width as number) / (item.height as number);
      expect(width / height).toBeCloseTo(expected, 5);
    }
  });

  it("preserves input order across rows", () => {
    const images = Array.from({ length: 15 }, (_, i) => ({ ...img(4, 3), id: i }));
    const rows = packRows(images, OPTS);
    const ids = rows.flatMap((r) => r.items.map((i) => (i.item as { id: number }).id));
    expect(ids).toEqual(images.map((i) => i.id));
  });

  it("does not stretch the final row", () => {
    // One trailing wide image would otherwise scale to full-bleed and dwarf the grid.
    const rows = packRows([img(4, 3), img(4, 3), img(4, 3), img(16, 9)], OPTS);
    const last = rows[rows.length - 1];
    expect(last.height).toBe(OPTS.targetHeight);
    expect(rowWidth(last.items, OPTS.gutter)).toBeLessThan(OPTS.containerWidth);
  });

  it("treats images with no dimensions as square", () => {
    const rows = packRows([{}, { width: null, height: null }], OPTS);
    const flat = rows.flatMap((r) => r.items.map((i) => ({ w: i.width, h: r.height })));
    for (const { w, h } of flat) expect(w / h).toBeCloseTo(1, 5);
  });

  it("treats zero and negative dimensions as square rather than dividing by zero", () => {
    const rows = packRows([img(0, 0), img(-4, 3), img(4, 0)], OPTS);
    for (const row of rows) {
      expect(Number.isFinite(row.height)).toBe(true);
      for (const i of row.items) expect(Number.isFinite(i.width)).toBe(true);
    }
  });

  it("puts a single image alone in an unstretched row", () => {
    const rows = packRows([img(3, 2)], OPTS);
    expect(rows).toHaveLength(1);
    expect(rows[0].items).toHaveLength(1);
    expect(rows[0].height).toBe(OPTS.targetHeight);
  });

  it("accounts for gutters when computing row height", () => {
    const images = Array.from({ length: 12 }, () => img(1, 1));
    const tight = packRows(images, { ...OPTS, gutter: 0 });
    const loose = packRows(images, { ...OPTS, gutter: 40 });
    // Wider gutters leave less width for the pictures, so rows get shorter.
    expect(loose[0].height).toBeLessThan(tight[0].height);
    expect(rowWidth(loose[0].items, 40)).toBeCloseTo(OPTS.containerWidth, 5);
  });

  it("defaults the target height when none is given", () => {
    const rows = packRows([img(3, 2)], { containerWidth: 1000 });
    expect(rows[0].height).toBe(DEFAULT_TARGET_HEIGHT);
  });
});
