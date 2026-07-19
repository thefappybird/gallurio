import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { WizardConflictConfirmDialog } from "./wizard-conflict-confirm-dialog";
import type { ShiftHit } from "./booking-wizard-steps/types";

const CONFLICT_SHIFT: ShiftHit = {
  id: "existing-1",
  title: "Existing Shoot",
  shiftStart: "10:00",
  shiftEnd: "13:00",
};

const SESSIONS = [
  { startDate: "2026-05-25", startTime: "10:00", endTime: "17:00" },
  { startDate: "2026-05-26", startTime: "14:00", endTime: "16:00" },
];

// Session 0 has a conflict; session 1 does not.
const CONFLICTS_MIXED: ShiftHit[][] = [[CONFLICT_SHIFT], []];

function renderDialog(
  open: boolean,
  conflicts: ShiftHit[][] = CONFLICTS_MIXED,
  onCancel = vi.fn(),
  onConfirm = vi.fn()
) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <WizardConflictConfirmDialog
        open={open}
        conflicts={conflicts}
        sessions={SESSIONS}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    </NextIntlClientProvider>
  );
}

describe("WizardConflictConfirmDialog", () => {
  it("renders the conflicting session's shift title when open", () => {
    renderDialog(true);
    expect(screen.getByText("Existing Shoot")).toBeDefined();
  });

  it("does not render the conflict-free session's date", () => {
    renderDialog(true);
    // "2026-05-26" is the session with no conflicts — its date should not appear.
    // The formatted date for May 26 would be "May 26, 2026" in en locale.
    expect(screen.queryByText(/may 26/i)).toBeNull();
  });

  it("only renders sessions WITH conflicts", () => {
    renderDialog(true, [[CONFLICT_SHIFT], []]);
    // Only one conflict group should be shown.
    const items = screen.queryAllByText("Existing Shoot");
    expect(items).toHaveLength(1);
  });

  it("calls onCancel when Go back is clicked", () => {
    const onCancel = vi.fn();
    renderDialog(true, CONFLICTS_MIXED, onCancel);
    fireEvent.click(screen.getByRole("button", { name: /go back/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Submit anyway is clicked", () => {
    const onConfirm = vi.fn();
    renderDialog(true, CONFLICTS_MIXED, vi.fn(), onConfirm);
    fireEvent.click(screen.getByRole("button", { name: /submit anyway/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not render when closed", () => {
    renderDialog(false);
    expect(screen.queryByText("Existing Shoot")).toBeNull();
  });

  it("formatSessionDate gracefully returns iso string for invalid date", () => {
    // Render with an invalid ISO date — the component should not throw.
    const invalidSessions = [{ startDate: "not-a-date", startTime: "10:00", endTime: "17:00" }];
    expect(() =>
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <WizardConflictConfirmDialog
            open={true}
            conflicts={[[CONFLICT_SHIFT]]}
            sessions={invalidSessions}
            onCancel={vi.fn()}
            onConfirm={vi.fn()}
          />
        </NextIntlClientProvider>
      )
    ).not.toThrow();
    // The raw string should appear as the date label.
    expect(screen.getByText("not-a-date")).toBeDefined();
  });
});
