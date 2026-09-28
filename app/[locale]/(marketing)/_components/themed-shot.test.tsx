import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ThemedShot } from "./themed-shot";

describe("ThemedShot", () => {
  it("renders both light and dark screenshots, toggled by CSS not a client hook", () => {
    render(<ThemedShot base="/marketing/screenshots/dashboard-overview" alt="Dashboard" sizes="100vw" />);

    const images = screen.getAllByAltText("Dashboard");
    expect(images).toHaveLength(2);

    const lightImage = images.find((img) => img.getAttribute("src")?.includes("dashboard-overview-light.png"));
    const darkImage = images.find((img) => img.getAttribute("src")?.includes("dashboard-overview-dark.png"));

    expect(lightImage).toHaveClass("dark:hidden");
    expect(darkImage).toHaveClass("hidden");
    expect(darkImage).toHaveClass("dark:block");
  });
});
