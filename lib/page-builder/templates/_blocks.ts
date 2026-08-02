/**
 * Block factories used by template seeds.
 *
 * Each top-level content item carries a stable `id` (required by PuckData shape).
 * Nested slot children inside preset containers do NOT need ids.
 *
 * Preset factories return a complete `{ type, props }` entry whose props are the
 * ContainerBlockProps from `sectionPresets.ts`, so presets render fully without
 * relying on Puck default-prop merging. Gallery/manual factories do the same for
 * their respective block types.
 */

import type { PuckBlockEntry, PuckData } from "@/lib/page-builder/types";
import {
  HERO_PRESET,
  ABOUT_PRESET,
  SERVICES_PRESET,
  CTA_PRESET,
  CONTACT_PRESET,
  GALLERY_LANDING_PRESET,
} from "@/lib/page-builder/blocks/sectionPresets";
import { galleryGridDefaultProps } from "@/lib/page-builder/blocks/GalleryGridBlock";
import { galleryMasonryDefaultProps } from "@/lib/page-builder/blocks/GalleryMasonryBlock";

// ---------------------------------------------------------------------------
// Preset section factories
// ---------------------------------------------------------------------------

export function heroPreset(id: string): PuckBlockEntry {
  return { type: "HeroPreset", props: { id, ...HERO_PRESET } };
}

export function aboutPreset(id: string): PuckBlockEntry {
  return { type: "AboutPreset", props: { id, ...ABOUT_PRESET } };
}

export function servicesPreset(id: string): PuckBlockEntry {
  return { type: "ServicesPreset", props: { id, ...SERVICES_PRESET } };
}

export function ctaPreset(id: string): PuckBlockEntry {
  return { type: "CtaPreset", props: { id, ...CTA_PRESET } };
}

export function contactPreset(id: string): PuckBlockEntry {
  return { type: "ContactPreset", props: { id, ...CONTACT_PRESET } };
}

// ---------------------------------------------------------------------------
// Gallery block factories
// ---------------------------------------------------------------------------

export function galleryGrid(
  id: string,
  props?: { columns?: 2 | 3 | 4; gap?: "tight" | "normal" | "loose" }
): PuckBlockEntry {
  return {
    type: "GalleryGrid",
    props: { id, ...galleryGridDefaultProps, columns: props?.columns ?? 3, gap: props?.gap ?? "normal" },
  };
}

export function galleryMasonry(
  id: string,
  props?: { columns?: 2 | 3 | 4; gap?: "tight" | "normal" | "loose" }
): PuckBlockEntry {
  return {
    type: "GalleryMasonry",
    props: { id, ...galleryMasonryDefaultProps, columns: props?.columns ?? 3, gap: props?.gap ?? "normal" },
  };
}

export function galleryLandingPreset(id: string): PuckBlockEntry {
  return { type: "GalleryLandingPreset", props: { id, ...GALLERY_LANDING_PRESET } };
}

// ---------------------------------------------------------------------------
// Manual block factories
// ---------------------------------------------------------------------------

export function heading(
  id: string,
  props: { text: string; level?: "h1" | "h2" | "h3"; align?: "left" | "center" | "right" }
): PuckBlockEntry {
  return {
    type: "Heading",
    props: {
      id,
      text: props.text,
      level: props.level ?? "h2",
      _style: props.align ? { align: props.align } : undefined,
    },
  };
}

/**
 * Columns block factory — creates a Columns layout block.
 * Pass pre-built slot content via `content` (defaults to empty []).
 */
export function columns(
  id: string,
  props: { columns: number; rows?: number; content?: unknown[] }
): PuckBlockEntry {
  return {
    type: "Columns",
    props: {
      id,
      columns: props.columns,
      rows: props.rows,
      content: props.content ?? [],
    },
  };
}

// ---------------------------------------------------------------------------
// Zone wrapper — wraps a content array in the PuckData envelope
// ---------------------------------------------------------------------------

export function zone(content: PuckBlockEntry[]): PuckData {
  // A starter template is a concrete design, so its page surface must be
  // explicit too. Keeping the token (rather than copying the preset hex) means
  // the page continues to follow later theme-background changes while the
  // editor canvas, preview, and public render all resolve the same saved value.
  return {
    content,
    root: {
      props: {
        _rootStyle: {
          bgColorToken: "background",
        },
      },
    },
  };
}
