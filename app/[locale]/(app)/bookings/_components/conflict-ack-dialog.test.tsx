import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { ConflictAckDialog } from "./conflict-ack-dialog";
import type { ShiftHit } from "./booking-wizard-steps/event-step";
import type { WizardValues } from "./booking-wizard-steps/types";

type WizardSession = WizardValues["sessions"][number];

const SESSION: WizardSession = {
  startDate: "2026-05-27",
  startTime: "10:00",
  endDate: "2026-05-27",
  endTime: "17:00",
  singleDay: true,
  allowPastDate: false,
};

const CONFLICT: ShiftHit = {
  id: "abc123",
  title: "Carter Wedding",
  shiftStart: "09:00",
  shiftEnd: "16:00",
};

function renderDialog(props: Parameters<typeof ConflictAckDialog>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <ConflictAckDialog {...props} />
    </NextIntlClientProvider>
  );
}

describe("ConflictAckDialog", () => {
  beforeEach(() => {
    cleanup();
  });

  it("renders title when open with conflicts", () => {
    const { getByText } = renderDialog({
      open: true,
      conflicts: [[CONFLICT]],
      sessions: [SESSION],
      onCancel: vi.fn(),
      onProceed: vi.fn(),
    });
    expect(getByText("Scheduling conflicts")).toBeInTheDocument();
  });

  it("displays conflicting shift title and times", () => {
    const { getAllByRole } = renderDialog({
      open: true,
      conflicts: [[CONFLICT]],
      sessions: [SESSION],
      onCancel: vi.fn(),
      onProceed: vi.fn(),
    });
    // Conflict title and times are text nodes inside <li>; check via textContent.
    const items = getAllByRole("listitem");
    const text = items.map((el) => el.textContent ?? "").join(" ");
    expect(text).toContain("Carter Wedding");
    expect(text).toContain("09:00");
    expect(text).toContain("16:00");
  });

  it("calls onProceed when 'Proceed anyway' is clicked", () => {
    const onProceed = vi.fn();
    const { getByRole } = renderDialog({
      open: true,
      conflicts: [[CONFLICT]],
      sessions: [SESSION],
      onCancel: vi.fn(),
      onProceed,
    });
    fireEvent.click(getByRole("button", { name: /proceed anyway/i }));
    expect(onProceed).toHaveBeenCalledOnce();
  });

  it("calls onCancel when 'Go back and edit' is clicked", () => {
    const onCancel = vi.fn();
    const { getByRole } = renderDialog({
      open: true,
      conflicts: [[CONFLICT]],
      sessions: [SESSION],
      onCancel,
      onProceed: vi.fn(),
    });
    fireEvent.click(getByRole("button", { name: /go back and edit/i }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("renders conflicts for multiple sessions", () => {
    const session2: WizardSession = { ...SESSION, startDate: "2026-06-10" };
    const conflict2: ShiftHit = {
      id: "def456",
      title: "Reyes Anniversary",
      shiftStart: "11:00",
      shiftEnd: "14:00",
    };
    const { getAllByRole } = renderDialog({
      open: true,
      conflicts: [[CONFLICT], [conflict2]],
      sessions: [SESSION, session2],
      onCancel: vi.fn(),
      onProceed: vi.fn(),
    });
    // Both conflict titles appear as text nodes inside <li> items.
    const items = getAllByRole("listitem");
    const texts = items.map((el) => el.textContent ?? "");
    expect(texts.some((t) => t.includes("Carter Wedding"))).toBe(true);
    expect(texts.some((t) => t.includes("Reyes Anniversary"))).toBe(true);
  });

  it("renders nothing visible when open=false", () => {
    const { queryByText } = renderDialog({
      open: false,
      conflicts: [[CONFLICT]],
      sessions: [SESSION],
      onCancel: vi.fn(),
      onProceed: vi.fn(),
    });
    expect(queryByText("Scheduling conflicts")).not.toBeInTheDocument();
  });
});
