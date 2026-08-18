import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoweredByGallurio } from "./PoweredByGallurio";

describe("PoweredByGallurio", () => {
  it("links to gallurio.com without suppressing the link for crawlers", () => {
    render(<PoweredByGallurio label="Powered by Gallurio" />);

    const link = screen.getByRole("link", { name: "Powered by Gallurio" });

    expect(link).toHaveAttribute("href", "https://gallurio.com");
    // The whole point is that this passes authority back, so it must not be
    // nofollow'd.
    expect(link.getAttribute("rel") ?? "").not.toContain("nofollow");
  });
});
