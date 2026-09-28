import Image from "next/image";

// Product screenshots are static images, not theme-aware CSS — so unlike
// AmbientBackground (one SVG, recolored via currentColor) this needs two
// actual screenshots of the app in each theme. Both are rendered, but only
// the active theme's variant is ever painted (`dark:hidden` /
// `hidden dark:block`); the hidden one is `display:none`, which browsers
// don't fetch, so this still costs one image download, not two, and — unlike
// swapping post-mount on the client — has no light-theme flash on first
// paint for dark-mode visitors. Same `alt` on both is fine: the hidden image
// isn't in the accessibility tree.
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
  return (
    <>
      <Image
        src={`${base}-light.png`}
        alt={alt}
        fill
        sizes={sizes}
        className={`object-cover ${className ?? ""} dark:hidden`}
      />
      <Image
        src={`${base}-dark.png`}
        alt={alt}
        fill
        sizes={sizes}
        className={`object-cover ${className ?? ""} hidden dark:block`}
      />
    </>
  );
}
