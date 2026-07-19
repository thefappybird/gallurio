import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NotFoundContent } from "./not-found";

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
      "/brand/gallurio-sq.svg"
    );
  });
});
