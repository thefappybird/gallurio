import { it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DraftNameEditor } from "./DraftNameEditor";

it("truncates a long title to a fixed width and renders the error in smaller text", () => {
  render(
    <DraftNameEditor
      name="New Draft lorem ipsum dolor sit amet consectetur"
      onCommit={vi.fn()}
      error="A draft with this name already exists"
    />
  );
  const title = screen.getByTitle("New Draft lorem ipsum dolor sit amet consectetur");
  expect(title.className).toContain("truncate");
  expect(title.className).toMatch(/max-w-\[/); // fixed/max width cap
  const err = screen.getByRole("alert");
  expect(err.className).toContain("text-[11px]"); // smaller than text-xs
});
