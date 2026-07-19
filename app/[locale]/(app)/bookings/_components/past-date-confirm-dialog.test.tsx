import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PastDateConfirmDialog } from "./past-date-confirm-dialog";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      title: "Move to a past date?",
      description:
        "You're moving this booking to a date in the past. This is allowed but unusual — confirm to continue.",
      confirm: "Move to past",
      cancel: "Cancel",
    };
    return map[key] ?? key;
  },
}));

describe("PastDateConfirmDialog", () => {
  it("renders title and description when open", () => {
    render(
      <PastDateConfirmDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByText("Move to a past date?")).toBeDefined();
    expect(
      screen.getByText(
        "You're moving this booking to a date in the past. This is allowed but unusual — confirm to continue."
      )
    ).toBeDefined();
  });

  it("renders Cancel and Move to past buttons", () => {
    render(
      <PastDateConfirmDialog open onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDefined();
    expect(screen.getByRole("button", { name: "Move to past" })).toBeDefined();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    render(
      <PastDateConfirmDialog open onCancel={onCancel} onConfirm={vi.fn()} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Move to past is clicked", () => {
    const onConfirm = vi.fn();
    render(
      <PastDateConfirmDialog open onCancel={vi.fn()} onConfirm={onConfirm} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Move to past" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not render when closed", () => {
    render(
      <PastDateConfirmDialog open={false} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(screen.queryByText("Move to a past date?")).toBeNull();
  });
});
