import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotFoundContent, metadata } from "./global-not-found";

describe("global-not-found metadata", () => {
  it("sets a tab title instead of the bare URL", () => {
    expect(metadata.title).toBe("Page not found | Gallurio");
  });
});

describe("NotFoundContent", () => {
  it("renders a home link", () => {
    render(<NotFoundContent />);
    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toHaveAttribute("href", "/");
  });

  it("shows the branded logo and not-found message", () => {
    render(<NotFoundContent />);
    expect(screen.getByText("Page not found")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Gallurio" })).toHaveAttribute(
      "src",
      "/brand/gallurio-sq-128.png"
    );
  });
});
