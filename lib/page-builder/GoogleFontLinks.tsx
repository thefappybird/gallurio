/**
 * Server-rendered Google Fonts `<link rel="stylesheet">` for public-page
 * render paths (layout, home, gallery) — the font family list there is
 * request-known upfront, so a plain server-rendered `<link>` avoids the
 * client-mount-then-inject FOUC/reflow of `GoogleFontLoader`. Deliberately
 * NOT `"use client"` (unlike GoogleFontLoader.tsx) so Next.js renders it as
 * a real Server Component with zero client JS.
 *
 * `precedence` is required for React 19's built-in stylesheet resource
 * support: without it, `<link rel="stylesheet">` is treated as a plain DOM
 * element (rendered inline, not hoisted, not deduped) instead of a managed
 * resource — which matters here since layout+page can render overlapping
 * family sets for the same request.
 *
 * Keep `GoogleFontLoader` (client, dynamic mount/unmount, refcounted) for
 * the editor canvas, where fonts change live as the owner edits.
 */

import { googleFontsCssUrl, googleFontSlug } from "./fonts";

export function GoogleFontLinks({ families }: { families: string[] }) {
  const unique = Array.from(new Set(families.filter(Boolean)));
  return (
    <>
      {unique.map((family) => (
        <link
          key={googleFontSlug(family)}
          rel="stylesheet"
          href={googleFontsCssUrl(family)}
          precedence="high"
          data-google-font={family}
        />
      ))}
    </>
  );
}
