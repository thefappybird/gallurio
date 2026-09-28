import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { ContainerBackgroundSlideshow } from "./ContainerBackgroundSlideshow";

const IMAGES = [
  { id: "a", src: "https://x/a.jpg" },
  { id: "b", src: "https://x/b.jpg" },
  { id: "c", src: "https://x/c.jpg" },
];

function setReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
}

beforeEach(() => {
  setReducedMotion(false);
  setHidden(false);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ContainerBackgroundSlideshow", () => {
  it("mounts prev+active+next layers (crossfade), bounded by image count", () => {
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="medium" />
    );
    const layers = container.querySelectorAll("[data-bg-layer]");
    expect(layers.length).toBe(3);
    expect(container.querySelectorAll('[data-active="true"]').length).toBe(1);
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("0");
  });

  it("with 5 images (crossfade), mounts at most 3 <img> layers, not all 5", () => {
    const FIVE = [
      { id: "a", src: "https://x/a.jpg" },
      { id: "b", src: "https://x/b.jpg" },
      { id: "c", src: "https://x/c.jpg" },
      { id: "d", src: "https://x/d.jpg" },
      { id: "e", src: "https://x/e.jpg" },
    ];
    const { container } = render(
      <ContainerBackgroundSlideshow images={FIVE} animation="crossfade" speed="medium" />
    );
    expect(container.querySelectorAll("img").length).toBeLessThanOrEqual(3);
  });

  it("marks the root with the animation mode", () => {
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="slide" speed="fast" />
    );
    expect(container.querySelector("[data-bg-slideshow]")?.getAttribute("data-animation")).toBe("slide");
  });

  it("advances to the next layer after the speed interval (medium = 5s)", () => {
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="medium" />
    );
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("0");
    act(() => { vi.advanceTimersByTime(5000); });
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("1");
  });

  it("advancing the timer keeps the outgoing layer mounted for its fade-out, and drops the one further behind", () => {
    const FIVE = [
      { id: "a", src: "https://x/a.jpg" },
      { id: "b", src: "https://x/b.jpg" },
      { id: "c", src: "https://x/c.jpg" },
      { id: "d", src: "https://x/d.jpg" },
      { id: "e", src: "https://x/e.jpg" },
    ];
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={FIVE} animation="crossfade" speed="medium" />
    );
    // Initially active=0: layers 4 (prev), 0 (active) and 1 (next) are mounted; 2 is not.
    expect(container.querySelector('[data-bg-layer="4"]')).not.toBeNull();
    expect(container.querySelector('[data-bg-layer="0"]')).not.toBeNull();
    expect(container.querySelector('[data-bg-layer="1"]')).not.toBeNull();
    expect(container.querySelector('[data-bg-layer="2"]')).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    // Now active=1: outgoing layer 0 stays mounted (opacity 0) to finish its
    // crossfade; layer 2 (new next) mounts; layer 4 (two behind) drops.
    expect(container.querySelector('[data-bg-layer="1"]')?.getAttribute("data-active")).toBe("true");
    expect(container.querySelector('[data-bg-layer="0"]')).not.toBeNull();
    expect(container.querySelector('[data-bg-layer="0"]')?.getAttribute("data-active")).toBe("false");
    expect(container.querySelector('[data-bg-layer="2"]')).not.toBeNull();
    expect(container.querySelector('[data-bg-layer="4"]')).toBeNull();
  });

  it("slide animation mounts at most 3 layers (prev + active + next)", () => {
    const FIVE = [
      { id: "a", src: "https://x/a.jpg" },
      { id: "b", src: "https://x/b.jpg" },
      { id: "c", src: "https://x/c.jpg" },
      { id: "d", src: "https://x/d.jpg" },
      { id: "e", src: "https://x/e.jpg" },
    ];
    const { container } = render(
      <ContainerBackgroundSlideshow images={FIVE} animation="slide" speed="medium" />
    );
    expect(container.querySelectorAll("img").length).toBeLessThanOrEqual(3);
  });

  it("fast speed advances at 3s", () => {
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="fast" />
    );
    act(() => { vi.advanceTimersByTime(3000); });
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("1");
  });

  it("under prefers-reduced-motion renders only the first image and never advances", () => {
    setReducedMotion(true);
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="kenburns" speed="fast" />
    );
    expect(container.querySelectorAll("[data-bg-layer]").length).toBe(1);
    act(() => { vi.advanceTimersByTime(60000); });
    expect(container.querySelectorAll("[data-bg-layer]").length).toBe(1);
    expect(container.querySelector('[data-bg-layer]')?.getAttribute("data-active")).toBe("true");
  });

  it("pauses advancing while the tab is hidden", () => {
    vi.useFakeTimers();
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="fast" />
    );
    act(() => {
      setHidden(true);
      document.dispatchEvent(new Event("visibilitychange"));
    });
    act(() => { vi.advanceTimersByTime(30000); });
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("0");
  });

  it("is decorative: root is aria-hidden and every image has empty alt", () => {
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="slow" />
    );
    expect(container.querySelector("[data-bg-slideshow]")?.getAttribute("aria-hidden")).toBe("true");
    container.querySelectorAll("img").forEach((img) => expect(img.getAttribute("alt")).toBe(""));
  });
});
