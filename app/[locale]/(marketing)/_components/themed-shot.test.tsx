import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemedShot } from "./themed-shot";

describe("ThemedShot", () => {
  it("renders a light-theme image and a dark-theme image from the same base path", () => {
    render(<ThemedShot base="/marketing/screenshots/dashboard-overview" alt="Dashboard" sizes="100vw" />);

    const images = screen.getAllByAltText("Dashboard");
    expect(images).toHaveLength(2);
    expect(images.map((img) => img.getAttribute("src"))).toEqual(
      expect.arrayContaining([
        expect.stringContaining("dashboard-overview-light.png"),
        expect.stringContaining("dashboard-overview-dark.png"),
      ]),
    );
  });
});
