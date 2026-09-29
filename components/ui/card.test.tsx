import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CardTitle } from "./card";

describe("CardTitle", () => {
  it("renders a div by default (backward compatible)", () => {
    render(<CardTitle>Title</CardTitle>);
    const title = screen.getByText("Title");
    expect(title.tagName).toBe("DIV");
  });

  it("renders the given heading element when as is passed", () => {
    render(<CardTitle as="h2">Section title</CardTitle>);
    const heading = screen.getByRole("heading", { level: 2, name: "Section title" });
    expect(heading.tagName).toBe("H2");
  });
});
