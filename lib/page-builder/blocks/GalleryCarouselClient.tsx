"use client";

/**
 * Client island for GalleryCarouselBlock. Receives already-resolved thumbnail
 * URLs from the server block (no data fetching here). Provides scroll-snap
 * navigation, keyboard-accessible prev/next buttons, and optional autoplay
 * (disabled under prefers-reduced-motion).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

export type CarouselSlide = {
  id: string;
  src: string;
  alt: string;
};

export type CarouselLabels = {
  hint: string;
  prev: string;
  next: string;
};

const ASPECT_RATIO: Record<"square" | "landscape" | "portrait", string> = {
  square: "1 / 1",
  landscape: "16 / 9",
  portrait: "3 / 4",
};

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

export function GalleryCarouselClient({
  slides,
  aspect,
  autoplay,
  labels,
}: {
  slides: CarouselSlide[];
  aspect: "square" | "landscape" | "portrait";
  autoplay: boolean;
  labels: CarouselLabels;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );

  function scrollByDir(dir: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const slide = track.querySelector<HTMLElement>("[data-slide]");
    // No inter-slide gap — step is exactly one slide width.
    const step = slide ? slide.offsetWidth : track.clientWidth;
    track.scrollBy({ left: dir * step, behavior: reducedMotion ? "auto" : "smooth" });
  }

  useEffect(() => {
    if (!autoplay || reducedMotion || paused || slides.length < 2) return;
    const id = window.setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (atEnd) {
        track.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scrollByDir(1);
      }
    }, 4000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, reducedMotion, paused, slides.length]);

  return (
    <div
      style={{ position: "relative", maxWidth: "80rem", margin: "0 auto" }}
      // Pause autoplay while the user is interacting (WCAG 2.2.2).
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <style>{`
        .pf-carousel-btn:focus-visible { outline: 2px solid var(--pf-color-accent); outline-offset: 2px; }
        .pf-carousel-btn:hover { opacity: 1; }
      `}</style>
      <div
        ref={trackRef}
        style={{
          display: "flex",
          gap: "0px",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollbarWidth: "none",
        }}
      >
        {slides.map((slide) => (
          <div
            key={slide.id}
            data-slide
            style={{
              flex: "0 0 88%",
              maxWidth: "880px",
              scrollSnapAlign: "center",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={slide.src}
              alt={slide.alt}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                aspectRatio: ASPECT_RATIO[aspect],
                objectFit: "cover",
                display: "block",
              }}
            />
          </div>
        ))}
      </div>

      {slides.length > 1 && (
        <>
          <CarouselButton dir="prev" label={labels.prev} onClick={() => scrollByDir(-1)} />
          <CarouselButton dir="next" label={labels.next} onClick={() => scrollByDir(1)} />
        </>
      )}

      <p
        style={{
          textAlign: "center",
          fontSize: "0.75rem",
          color: "var(--pf-color-fg)",
          opacity: 0.5,
          marginTop: "0.75rem",
        }}
      >
        {labels.hint}
      </p>
    </div>
  );
}

function CarouselButton({
  dir,
  label,
  onClick,
}: {
  dir: "prev" | "next";
  label: string;
  onClick: () => void;
}) {
  const isPrev = dir === "prev";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="pf-carousel-btn"
      style={{
        position: "absolute",
        top: "50%",
        [isPrev ? "left" : "right"]: "0.5rem",
        transform: "translateY(-50%)",
        width: "44px",
        height: "44px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--pf-color-bg)",
        color: "var(--pf-color-fg)",
        border: "1px solid var(--pf-color-fg)",
        borderRadius: "var(--pf-radius)",
        cursor: "pointer",
        opacity: 0.85,
        fontSize: "1.25rem",
        lineHeight: 1,
      }}
    >
      <span aria-hidden="true">{isPrev ? "‹" : "›"}</span>
    </button>
  );
}
