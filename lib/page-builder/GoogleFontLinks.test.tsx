import { describe, it, expect, afterEach, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { GoogleFontLinks } from "./GoogleFontLinks";

// happy-dom actually attempts to fetch stylesheet hrefs for a `precedence`d
// <link> — stub fetch so these tests never hit the real network.
vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("")));

afterEach(() => {
  cleanup();
  document.querySelectorAll("link[data-google-font]").forEach((el) => el.remove());
});

describe("GoogleFontLinks", () => {
  it("renders one deduped <link rel=stylesheet> per family", () => {
    // `precedence` makes React treat this as a managed stylesheet resource,
    // which it hoists straight into <head> rather than the render container.
    render(<GoogleFontLinks families={["Poppins", "Poppins", "Lora"]} />);
    const links = document.head.querySelectorAll("link[data-google-font]");
    expect(links.length).toBe(2);
    expect(links[0]).toHaveAttribute("rel", "stylesheet");
    expect(links[0]).toHaveAttribute("data-google-font", "Poppins");
    expect(links[0].getAttribute("href")).toContain("Poppins");
    expect(links[1]).toHaveAttribute("data-google-font", "Lora");
  });
});
