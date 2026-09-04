/**
 * Justified-gallery row packer.
 *
 * A justified row is scaled so every photograph in it shares one height and the
 * row exactly fills the container width. That height is NOT a free parameter —
 * it falls out of the aspect ratios in the row:
 *
 *   rowHeight = (containerWidth - totalGutter) / sum(aspectRatio)
 *
 * So packing is a matter of choosing where to break, not how tall to make
 * things. We greedily add items until the resulting height first drops to or
 * below the target, then keep whichever break (before or after that item) lands
 * closer to the target — which stops a row of two wide images from towering over
 * a row of five narrow ones.
 *
 * Pure: no React, no DOM, no imports. The caller supplies the container width,
 * so this runs identically on the server and in the editor canvas.
 */

/** Only the two fields the packer needs. Anything else on the image is ignored. */
export type PackableImage = { width?: number | null; height?: number | null };

export type PackedItem<T> = {
  item: T;
  /** Rendered width in px, gutters excluded. */
  width: number;
};

export type PackedRow<T> = {
  items: PackedItem<T>[];
  /** Shared height in px for every item in the row. */
  height: number;
};

export type PackOptions = {
  /** Container width in px, padding already subtracted. */
  containerWidth: number;
  /** Height to aim for. Rows land near it, never exactly on it. */
  targetHeight?: number;
  /** Gap between items in a row, in px. Also the gap between rows. */
  gutter?: number;
  /**
   * How far a row may stray from `targetHeight`, as a fraction. The final row
   * is the only one allowed past it — see below.
   */
  tolerance?: number;
};

export const DEFAULT_TARGET_HEIGHT = 280;
export const DEFAULT_GUTTER = 4;
export const DEFAULT_TOLERANCE = 0.25;

/**
 * Images predating the dimension columns have no width/height. Falling back to
 * 1:1 keeps them in the flow at a sane size instead of collapsing the row to
 * zero height (division by a zero aspect sum) or blowing it up.
 */
const FALLBACK_ASPECT = 1;

function aspectOf(img: PackableImage): number {
  const w = img.width;
  const h = img.height;
  if (typeof w !== "number" || typeof h !== "number") return FALLBACK_ASPECT;
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return FALLBACK_ASPECT;
  return w / h;
}

/** Height a row of these aspect ratios takes when stretched to fill the width. */
function heightFor(aspectSum: number, count: number, containerWidth: number, gutter: number): number {
  const available = containerWidth - gutter * Math.max(0, count - 1);
  if (aspectSum <= 0) return 0;
  return available / aspectSum;
}

/**
 * Packs `images` into justified rows.
 *
 * The last row is deliberately NOT stretched to fill the width — a trailing row
 * holding one photograph would otherwise scale it to full-bleed and dwarf
 * everything above it. It renders at the target height instead, left-aligned,
 * which is what every justified gallery does and what readers expect.
 */
export function packRows<T extends PackableImage>(
  images: readonly T[],
  options: PackOptions
): PackedRow<T>[] {
  const {
    containerWidth,
    targetHeight = DEFAULT_TARGET_HEIGHT,
    gutter = DEFAULT_GUTTER,
  } = options;

  if (images.length === 0) return [];
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return [];

  const rows: PackedRow<T>[] = [];
  let current: T[] = [];
  let aspectSum = 0;

  const flush = (stretch: boolean) => {
    if (current.length === 0) return;
    const height = stretch
      ? heightFor(aspectSum, current.length, containerWidth, gutter)
      : targetHeight;
    rows.push({
      height,
      items: current.map((item) => ({ item, width: height * aspectOf(item) })),
    });
    current = [];
    aspectSum = 0;
  };

  for (const image of images) {
    const aspect = aspectOf(image);
    const heightBefore = current.length
      ? heightFor(aspectSum, current.length, containerWidth, gutter)
      : Infinity;
    const heightAfter = heightFor(aspectSum + aspect, current.length + 1, containerWidth, gutter);

    // Adding this image drops the row to/below target. Break at whichever side
    // sits closer to the target rather than always breaking after — otherwise a
    // row that overshoots badly still wins over a much better break before it.
    if (heightAfter <= targetHeight) {
      const closerWithout =
        current.length > 0 &&
        Math.abs(heightBefore - targetHeight) < Math.abs(heightAfter - targetHeight);

      if (closerWithout) {
        flush(true);
        current = [image];
        aspectSum = aspect;
      } else {
        current.push(image);
        aspectSum += aspect;
        flush(true);
      }
      continue;
    }

    current.push(image);
    aspectSum += aspect;
  }

  flush(false);
  return rows;
}
