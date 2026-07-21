import Image from "next/image";

// Product screenshots are static images, not theme-aware CSS — so unlike
// AmbientBackground (one SVG, recolored via currentColor) this needs two
// actual screenshots of the app in each theme, swapped the same way
// (dark:hidden / dark:block) so the embedded UI always matches the
// visitor's current theme instead of always showing one fixed shell.
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
        className={`object-cover dark:hidden ${className ?? ""}`}
      />
      <Image
        src={`${base}-dark.png`}
        alt={alt}
        fill
        sizes={sizes}
        className={`hidden object-cover dark:block ${className ?? ""}`}
      />
    </>
  );
}
