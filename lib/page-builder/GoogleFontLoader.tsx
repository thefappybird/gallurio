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

// Multiple instances can be mounted at once (editor canvas + public page
// brand kit + public page block content — see file docblock) with
// overlapping family sets, all sharing the same deduped <link> per family.
// This refcounts each link's id across instances so one instance dropping a
// family it no longer needs never removes a link another mounted instance
// still relies on; the link is only actually removed once no instance wants it.
const fontLinkRefCounts = new Map<string, number>();

export function GoogleFontLoader({ families }: GoogleFontLoaderProps) {
  const unique = Array.from(new Set(families.filter(Boolean)));
  const key = unique.join("|");

  useEffect(() => {
    if (typeof document === "undefined") return;
    const ids = unique.map((family) => `pf-google-font-${googleFontSlug(family)}`);

    unique.forEach((family, i) => {
      const id = ids[i];
      const prevCount = fontLinkRefCounts.get(id) ?? 0;
      fontLinkRefCounts.set(id, prevCount + 1);
      if (prevCount === 0 && !document.getElementById(id)) {
        const link = document.createElement("link");
        link.id = id;
        link.rel = "stylesheet";
        link.href = googleFontsCssUrl(family);
        link.setAttribute("data-google-font", family);
        document.head.appendChild(link);
      }
    });

    // Release this run's families on cleanup — runs before the next effect
    // (family set changed) and on unmount. Only removes the <link> once its
    // refcount hits zero, so a still-needed shared family survives.
    return () => {
      for (const id of ids) {
        const nextCount = (fontLinkRefCounts.get(id) ?? 1) - 1;
        if (nextCount <= 0) {
          fontLinkRefCounts.delete(id);
          document.getElementById(id)?.remove();
        } else {
          fontLinkRefCounts.set(id, nextCount);
        }
      }
    };
    // `unique` is recomputed from `families` every render; `key` is its stable
    // dependency so the effect only re-runs when the actual family set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return null;
}
