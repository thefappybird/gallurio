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
  it("renders one layer per image with the active layer marked (crossfade)", () => {
    const { container } = render(
      <ContainerBackgroundSlideshow images={IMAGES} animation="crossfade" speed="medium" />
    );
    const layers = container.querySelectorAll("[data-bg-layer]");
    expect(layers.length).toBe(3);
    expect(container.querySelectorAll('[data-active="true"]').length).toBe(1);
    expect(container.querySelector('[data-active="true"]')?.getAttribute("data-bg-layer")).toBe("0");
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
