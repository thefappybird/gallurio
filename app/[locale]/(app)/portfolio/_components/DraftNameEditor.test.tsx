import { describe, it, expect, vi } from "vitest";
import { createRef } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DraftNameEditor, type DraftNameEditorHandle } from "./DraftNameEditor";

describe("DraftNameEditor", () => {
  it("shows the name and a pencil button in read mode", () => {
    render(<DraftNameEditor name="New Draft" onCommit={vi.fn()} error={null} />);
    expect(screen.getByText("New Draft")).toBeTruthy();
    expect(screen.getByRole("button", { name: /rename draft/i })).toBeTruthy();
  });

  it("edits then commits the new name", () => {
    const onCommit = vi.fn();
    render(<DraftNameEditor name="New Draft" onCommit={onCommit} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /rename draft/i }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Spring Wedding" } });
    fireEvent.click(screen.getByRole("button", { name: /confirm name/i }));
    expect(onCommit).toHaveBeenCalledWith("Spring Wedding");
  });

  it("cancel restores the original name without committing", () => {
    const onCommit = vi.fn();
    render(<DraftNameEditor name="New Draft" onCommit={onCommit} error={null} />);
    fireEvent.click(screen.getByRole("button", { name: /rename draft/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Throwaway" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel rename/i }));
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText("New Draft")).toBeTruthy();
  });

  it("renders an inline error", () => {
    render(<DraftNameEditor name="New Draft" onCommit={vi.fn()} error="A draft with this name already exists" />);
    expect(screen.getByRole("alert").textContent).toMatch(/already exists/i);
  });

  it("commit() handle flushes an in-progress edit and returns the new name", () => {
    const onCommit = vi.fn();
    const ref = createRef<DraftNameEditorHandle>();
    render(<DraftNameEditor ref={ref} name="New Draft" onCommit={onCommit} error={null} />);
    // Start editing, type a new name
    fireEvent.click(screen.getByRole("button", { name: /rename draft/i }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Pending Name" } });
    // Commit programmatically (simulates Save button calling ref.current.commit())
    const committed = ref.current?.commit();
    expect(committed).toBe("Pending Name");
    expect(onCommit).toHaveBeenCalledWith("Pending Name");
  });

  it("commit() handle returns null when not in editing mode", () => {
    const ref = createRef<DraftNameEditorHandle>();
    render(<DraftNameEditor ref={ref} name="New Draft" onCommit={vi.fn()} error={null} />);
    expect(ref.current?.commit()).toBeNull();
  });

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
    expect(title.className).toContain("max-w-24"); // compact fixed/max width cap
    const err = screen.getByRole("alert");
    expect(err.className).toContain("text-[11px]"); // smaller than text-xs
  });
});
