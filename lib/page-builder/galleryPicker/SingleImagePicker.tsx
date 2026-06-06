"use client";

import { ImagePlusIcon, Loader2Icon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePickerData } from "./usePickerData";
import type { PickerItem } from "./types";

// Plain strings — the Puck editor panel is not wrapped in an IntlProvider, so we
// match Puck's own English chrome here (see RELEASE-CHECKLIST §4f).
const L = {
  loading: "Loading photos…",
  error: "Could not load photos.",
  retry: "Retry",
  empty: "No photos yet. Add some in “Photos” (top toolbar), then pick one here.",
  clear: "Clear image",
  selected: "Selected",
  none: "No background image",
};

type Props = {
  /** Current value: a Cloudinary public ID ("" = none). */
  value: string;
  onChange: (publicId: string) => void;
};

/**
 * Picks ONE already-uploaded photo from the workspace's library for a single
 * image field (Hero / CTA background). Stores the photo's Cloudinary public ID —
 * the owner never sees an ID. Uploading new photos happens in the Collections
 * manager, not here (pick-only by design).
 */
export function SingleImagePicker({ value, onChange }: Props) {
  const { state, retry } = usePickerData();

  if (state.status === "loading") {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" aria-hidden />
        <span>{L.loading}</span>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex flex-col gap-2 py-4">
        <p className="text-sm text-destructive">{L.error}</p>
        <button
          type="button"
          onClick={retry}
          className="self-start text-xs underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {L.retry}
        </button>
      </div>
    );
  }

  const items: PickerItem[] = state.status === "ok" ? state.data.items : [];

  if (items.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{L.empty}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {value ? L.selected : L.none}
        </span>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
          >
            <XIcon className="size-3" aria-hidden />
            {L.clear}
          </button>
        )}
      </div>
      <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4" role="listbox" aria-label="Photos">
        {items.map((item) => {
          const selected = item.publicId === value;
          return (
            <li key={item.id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onChange(selected ? "" : item.publicId)}
                aria-label={`${item.caption || "Photo"}${selected ? ` — ${L.selected}` : ""}`}
                className={cn(
                  "relative block aspect-square w-full overflow-hidden border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  selected ? "border-foreground" : "border-border hover:bg-accent/40 focus-visible:bg-accent/40"
                )}
              >
                {item.thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.thumbUrl} alt="" className="size-full object-cover" loading="lazy" />
                ) : (
                  <span className="flex size-full items-center justify-center bg-muted">
                    <ImagePlusIcon className="size-5 text-muted-foreground" aria-hidden />
                  </span>
                )}
                {selected && (
                  <span className="absolute inset-0 flex items-center justify-center bg-foreground/60">
                    <span className="text-xs font-medium text-background">{L.selected}</span>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
