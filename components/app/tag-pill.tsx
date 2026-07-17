import { cn } from "@/lib/utils";

// A stable hash gives every user-entered word its own accent without colors
// shuffling on each render (which would be visually noisy and inaccessible).
const BORDER_CLASSES = [
  "border-brand/60",
  "border-info/60",
  "border-success/60",
  "border-warning/70",
  "border-destructive/55",
];

export function tagBorderClass(tag: string): string {
  let hash = 0;
  for (let index = 0; index < tag.length; index += 1) hash = (hash * 31 + tag.charCodeAt(index)) | 0;
  return BORDER_CLASSES[Math.abs(hash) % BORDER_CLASSES.length];
}

export function TagPill({ tag, className }: { tag: string; className?: string }) {
  return (
    <span className={cn("inline-flex max-w-full items-center border bg-muted px-1.5 py-px text-[11px] leading-4", tagBorderClass(tag), className)}>
      <span className="truncate">{tag}</span>
    </span>
  );
}
