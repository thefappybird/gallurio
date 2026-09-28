import Image from "next/image";

const LIGHT_BACKGROUND = "/onboarding/background-light.svg";
const DARK_BACKGROUND = "/onboarding/background-dark.svg";

function BackgroundImageLayer({
  src,
  className,
}: {
  src: string;
  className: string;
}) {
  return (
    <div className={`animate-ambient-drift absolute -inset-[6%] ${className}`}>
      <Image src={src} alt="" fill sizes="100vw" className="object-cover" />
    </div>
  );
}

/**
 * Full-bleed, theme-aware, slowly-drifting SVG background. Shared across
 * onboarding, auth, and the marketing landing page's hero/final-CTA
 * sections. Caller positions/sizes it via a `relative` ancestor — this
 * component fills that ancestor with `absolute inset-0` and self-clips its
 * oversized drift range. Respects `prefers-reduced-motion` via the
 * `animate-ambient-drift` CSS keyframes (app/globals.css).
 *
 * Server component: only the active theme's SVG is ever fetched, since the
 * inactive layer is `display:none` (`block dark:hidden` / `hidden
 * dark:block`) and non-priority, so the browser skips it entirely.
 */
export function AmbientBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      <BackgroundImageLayer src={LIGHT_BACKGROUND} className="block dark:hidden" />
      <BackgroundImageLayer src={DARK_BACKGROUND} className="hidden dark:block" />
    </div>
  );
}
