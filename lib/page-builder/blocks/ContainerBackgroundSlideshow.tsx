"use client";

/**
 * ContainerBackgroundSlideshow — client island that animates a Container's
 * baked background images. Receives ALREADY-RESOLVED src URLs from the
 * isomorphic ContainerBlock (same split as GalleryCarouselBlock →
 * GalleryCarouselClient): the block owns Cloudinary URL building, this island
 * owns the timer, active-layer index, tab-visibility pause, and reduced-motion.
 *
 * GPU-friendly: only `opacity`/`transform` animate. Decorative: the whole layer
 * is aria-hidden and every <img> carries alt="" (it is a background, never a
 * foreground carousel — no interactive controls).
 */

import { useEffect, useState, useSyncExternalStore } from "react";

export type SlideshowImage = { id: string; src: string };
export type BgAnimation = "crossfade" | "kenburns" | "slide";
export type BgSpeed = "slow" | "medium" | "fast";

const SPEED_MS: Record<BgSpeed, number> = { slow: 7000, medium: 5000, fast: 3000 };

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const mq = window.matchMedia(REDUCED_MOTION_QUERY);
  mq.addEventListener("change", callback);
  return () => mq.removeEventListener("change", callback);
}
function getReducedMotionSnapshot() {
  if (typeof window.matchMedia !== "function") return false;
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

const LAYER_BASE: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

export function ContainerBackgroundSlideshow({
  images,
  animation,
  speed,
}: {
  images: SlideshowImage[];
  animation: BgAnimation;
  speed: BgSpeed;
}) {
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
  const [active, setActive] = useState(0);
  const [hidden, setHidden] = useState(false);

  // Pause off-screen (Page Visibility) — no animation churn on a hidden tab.
  useEffect(() => {
    function onVis() {
      setHidden(document.hidden);
    }
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  useEffect(() => {
    if (reducedMotion || hidden || images.length < 2) return;
    const interval = SPEED_MS[speed] ?? SPEED_MS.medium;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [reducedMotion, hidden, images.length, speed]);

  // Reduced motion → a single static first frame, no layering, no timer.
  if (reducedMotion) {
    const first = images[0];
    return (
      <div data-bg-slideshow data-animation={animation} aria-hidden="true" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        {first && (
          // eslint-disable-next-line @next/next/no-img-element
          <img data-bg-layer="0" data-active="true" src={first.src} alt="" style={LAYER_BASE} />
        )}
      </div>
    );
  }

  const showIndex = active % images.length;

  return (
    <div
      data-bg-slideshow
      data-animation={animation}
      aria-hidden="true"
      style={{ position: "absolute", inset: 0, overflow: "hidden" }}
    >
      {animation === "kenburns" && (
        <style>{`
          @keyframes pf-bg-kenburns {
            from { transform: scale(1); }
            to   { transform: scale(1.08); }
          }
        `}</style>
      )}
      {images.map((img, i) => {
        const isActive = i === showIndex;
        const style: React.CSSProperties = { ...LAYER_BASE };
        if (animation === "slide") {
          style.transform = `translateX(${(i - showIndex) * 100}%)`;
          style.transition = "transform 800ms ease-in-out";
        } else {
          style.opacity = isActive ? 1 : 0;
          style.transition = "opacity 1000ms ease-in-out";
          if (animation === "kenburns") {
            // Subtle continuous zoom; alternate so it never hard-resets.
            style.animation = "pf-bg-kenburns 8s ease-in-out infinite alternate";
          }
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={img.id}
            data-bg-layer={i}
            data-active={isActive}
            src={img.src}
            alt=""
            loading={isActive ? undefined : "lazy"}
            decoding="async"
            style={style}
          />
        );
      })}
    </div>
  );
}
