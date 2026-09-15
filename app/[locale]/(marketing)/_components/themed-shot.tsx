"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { resolveScheme } from "@/lib/theme/themes";

// Product screenshots are static images, not theme-aware CSS — so unlike
// AmbientBackground (one SVG, recolored via currentColor) this needs two
// actual screenshots of the app in each theme. Renders only the active
// variant (not both, hidden via CSS) so visitors fetch one image, not two.
// Defaults to the light variant for SSR/first paint and swaps to dark
// post-mount if that's the resolved theme — a brief flash on dark is an
// acceptable tradeoff for halving image bytes on every load. The `mounted`
// gate matters: next-themes only knows the real theme after its own
// localStorage read on the client, so reading `resolvedTheme` before mount
// would render a different `src` than the server did and trigger a
// hydration mismatch.
export function ThemedShot({
  base,
  alt,
  sizes,
  className,
}: {
  base: string;
  alt: string;
  sizes: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    Promise.resolve().then(() => setMounted(true));
  }, []);
  const scheme = resolveScheme(mounted ? resolvedTheme : undefined);

  return (
    <Image
      src={`${base}-${scheme}.png`}
      alt={alt}
      fill
      sizes={sizes}
      className={`object-cover ${className ?? ""}`}
    />
  );
}
