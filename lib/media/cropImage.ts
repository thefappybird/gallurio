import type { CropSpec } from "./cropSpecs";

export async function cropToFile(
  src: File,
  area: { x: number; y: number; width: number; height: number },
  spec: CropSpec,
  fileName: string
): Promise<File> {
  const bitmap = await createImageBitmap(src);
  const scale = Math.min(1, spec.maxWidth / area.width, spec.maxHeight / area.height);
  const w = Math.max(1, Math.round(area.width * scale));
  const h = Math.max(1, Math.round(area.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  ctx.drawImage(bitmap, area.x, area.y, area.width, area.height, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", 0.92);
  });
  if (!blob) throw new Error("encode_failed");

  return new File([blob], fileName, { type: "image/webp" });
}

export function webpName(originalName: string): string {
  if (!originalName) return "image.webp";
  const idx = originalName.lastIndexOf(".");
  const base = idx > 0 ? originalName.slice(0, idx) : originalName;
  return `${base || "image"}.webp`;
}
