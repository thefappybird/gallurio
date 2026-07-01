"use client";

/**
 * Injects a Google Fonts CSS2 `<link rel="stylesheet">` per family into
 * `<head>`. Owners can pick a Google Font (curated shortlist or free-text
 * family name, see fonts.ts) instead of the 8 self-hosted curated families —
 * unlike those, Google Fonts aren't known at build time (they're per-workspace
 * runtime data), so `next/font/google` can't be used; this is the dynamic
 * loading mechanism instead.
 *
 * Deduped by a stable per-family DOM id, so mounting this in multiple places
 * (editor canvas + public page brand kit + public page block content) that
 * happen to reference the same family only fetches it once.
 */

import { useEffect } from "react";
import { googleFontsCssUrl, googleFontSlug } from "./fonts";

type GoogleFontLoaderProps = {
  /** Google Fonts family names actually in use. Deduplicated internally. */
  families: string[];
};

export function GoogleFontLoader({ families }: GoogleFontLoaderProps) {
  const unique = Array.from(new Set(families.filter(Boolean)));
  const key = unique.join("|");

  useEffect(() => {
    if (typeof document === "undefined") return;
    for (const family of unique) {
      const id = `pf-google-font-${googleFontSlug(family)}`;
      if (document.getElementById(id)) continue;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = googleFontsCssUrl(family);
      link.setAttribute("data-google-font", family);
      document.head.appendChild(link);
    }
    // `unique` is recomputed from `families` every render; `key` is its stable
    // dependency so the effect only re-runs when the actual family set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
