import { collectBlocks } from "@/lib/page-builder/blockTree";
import type { PuckData } from "@/lib/page-builder/types";

/**
 * First image ref in render order of the published home tree: blocks in
 * `collectBlocks` order (parent before its nested slots), and within a block
 * `backgroundImages` before `images`. Entries without a non-empty string
 * `publicId` are skipped.
 */
export function firstHomeImage(home: PuckData | null): { publicId: string } | null {
  if (!home) return null;
  for (const block of collectBlocks(home)) {
    for (const key of ["backgroundImages", "images"]) {
      const list = block.props[key];
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        const publicId = (entry as { publicId?: unknown } | null)?.publicId;
        if (typeof publicId === "string" && publicId !== "") return { publicId };
      }
    }
  }
  return null;
}
