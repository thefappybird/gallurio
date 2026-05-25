import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { DropConflictDialog, type ShiftHit } from "./drop-conflict-dialog";

const CONFLICTS: ShiftHit[] = [
  { id: "s1", title: "Wedding Shoot", shiftStart: "10:00", shiftEnd: "13:00" },
  { id: "s2", title: "Portrait Session", shiftStart: "14:00", shiftEnd: "16:00" },
];

const PROPOSED_START = new Date(2026, 4, 25, 10, 0, 0);
const PROPOSED_END = new Date(2026, 4, 25, 13, 0, 0);

function renderDialog(
  open: boolean,
  onCancel = vi.fn(),
  onConfirm = vi.fn()
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <DropConflictDialog
        open={open}
        conflicts={CONFLICTS}
        proposedStart={PROPOSED_START}
        proposedEnd={PROPOSED_END}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </NextIntlClientProvider>
  );
}

describe("DropConflictDialog", () => {
  it("renders both conflict titles when open", () => {
    renderDialog(true);
    expect(screen.getByText("Wedding Shoot")).toBeDefined();
    expect(screen.getByText("Portrait Session")).toBeDefined();
  });

  it("renders Cancel and Move anyway buttons when open", () => {
    renderDialog(true);
    expect(screen.getByRole("button", { name: /cancel/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /move anyway/i })).toBeDefined();
  });

  it("calls onCancel when Cancel is clicked", () => {
    const onCancel = vi.fn();
    renderDialog(true, onCancel);
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Move anyway is clicked", () => {
    const onConfirm = vi.fn();
    renderDialog(true, vi.fn(), onConfirm);
    fireEvent.click(screen.getByRole("button", { name: /move anyway/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not render conflict titles when closed", () => {
    renderDialog(false);
    expect(screen.queryByText("Wedding Shoot")).toBeNull();
    expect(screen.queryByText("Portrait Session")).toBeNull();
  });
});
