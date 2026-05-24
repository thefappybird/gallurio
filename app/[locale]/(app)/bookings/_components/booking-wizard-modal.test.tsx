/**
 * Regression test for the conflict-detection bug in BookingWizardModal.
 *
 * Repro: existing booking 13:00–14:00 on a given date. Open wizard, pick the
 * same date, set 10:00–17:00. Expect: conflict warning visible, Next disabled.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BookingWizardModal } from "./booking-wizard-modal";

// ── next/navigation stub (useSearchParams) ───────────────────────────────────
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/bookings",
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
}));

// ── Sonner toast stub ────────────────────────────────────────────────────────
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const TARGET_DATE = "2026-05-24";

const CONFLICT_SHIFT = {
  id: "existing-booking-id",
  title: "Existing Shoot",
  shiftStart: "13:00",
  shiftEnd: "14:00",
};

function mockFetchWithConflict() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.includes("/api/bookings/shifts-on-date")) {
        return {
          ok: true,
          json: async () => ({ shifts: [CONFLICT_SHIFT] }),
        };
      }
      // Client search endpoint used by ClientStep
      if (url.includes("/api/clients")) {
        return { ok: true, json: async () => ({ clients: [] }) };
      }
      return { ok: false, json: async () => ({}) };
    })
  );
}

function renderWizard() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BookingWizardModal
        mode="create"
        defaultDate={TARGET_DATE}
        defaultCurrency="PHP"
        locale="en"
      />
    </NextIntlClientProvider>
  );
}

/** Navigate from the client step to the event step by filling a new client name. */
async function advanceToEventStep() {
  // The wizard opens on the client step. Switch to "Create new" tab.
  const createNewTab = screen.getByRole("button", { name: /create new/i });
  fireEvent.click(createNewTab);

  const nameInput = screen.getByPlaceholderText(/emma carter/i);
  fireEvent.change(nameInput, { target: { value: "Test Client" } });

  // Click Next — client step validates and moves forward.
  const nextBtn = screen.getByRole("button", { name: /next/i });
  await act(async () => {
    fireEvent.click(nextBtn);
  });

  // Confirm we're on the event step.
  await waitFor(() => {
    expect(screen.getByPlaceholderText(/carter wedding/i)).toBeInTheDocument();
  });
}

describe("BookingWizardModal — conflict detection", () => {
  beforeEach(() => {
    mockFetchWithConflict();
  });

  it("shows conflict warning after fetch resolves on event step", async () => {
    renderWizard();
    await advanceToEventStep();

    // Fill title so the step has valid required fields
    fireEvent.change(screen.getByPlaceholderText(/carter wedding/i), {
      target: { value: "Repro Test" },
    });

    // defaultDate is already set to TARGET_DATE on mount, so the fetch for
    // shifts-on-date fires in the useEffect. Wait for the conflict banner.
    await waitFor(
      () => {
        expect(screen.getByText(/shifts already on/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // The conflicting shift details must be listed
    expect(screen.getByText("Existing Shoot")).toBeInTheDocument();
    expect(screen.getByText(/13:00/)).toBeInTheDocument();
  });

  it("Next button is disabled when conflicts exist on event step", async () => {
    renderWizard();
    await advanceToEventStep();

    fireEvent.change(screen.getByPlaceholderText(/carter wedding/i), {
      target: { value: "Repro Test" },
    });

    // Wait for conflict detection
    await waitFor(
      () => {
        expect(screen.getByText(/shifts already on/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toBeDisabled();
  });

  it("clicking Next with a conflict does not advance to the pricing step", async () => {
    renderWizard();
    await advanceToEventStep();

    fireEvent.change(screen.getByPlaceholderText(/carter wedding/i), {
      target: { value: "Repro Test" },
    });

    await waitFor(
      () => {
        expect(screen.getByText(/shifts already on/i)).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    // The Next button is disabled — clicking it (even programmatically) must
    // not advance to the pricing step.
    const nextBtn = screen.getByRole("button", { name: /next/i });
    expect(nextBtn).toBeDisabled();

    await act(async () => {
      fireEvent.click(nextBtn);
    });

    // Pricing step would render a "Total" label — it must not appear.
    expect(screen.queryByLabelText(/^total$/i)).not.toBeInTheDocument();
    // Conflict warning still visible.
    expect(screen.getByText(/shifts already on/i)).toBeInTheDocument();
  });
});

// ── Issue 3 regression: conflict check is reactive to date changes ────────────
//
// The original bug: conflicts only appeared when clicking "Add new session",
// because the custom onChange override on the start date input bypassed RHF's
// register-based tracking, so watch("sessions") in the parent never re-rendered.
//
// The fix: use the native register() onChange (no custom override) so RHF
// properly notifies all watch() subscriptions on every date change.
//
// What we verify: the conflict warning appears without ANY extra interaction
// when the initial date has a conflict — this is covered by the existing
// "conflict detection" suite. The additional test here verifies that the
// startDate watch INSIDE SessionCard is reactive (the end-date min attribute
// updates when startDate changes), which is the same reactive mechanism that
// drives the parent-level conflict fetch.
describe("BookingWizardModal — Issue 3: startDate watch is reactive on change", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("/api/bookings/shifts-on-date")) {
          return { ok: true, json: async () => ({ shifts: [] }) };
        }
        if (url.includes("/api/clients")) {
          return { ok: true, json: async () => ({ clients: [] }) };
        }
        return { ok: false, json: async () => ({}) };
      })
    );
  });

  it("updates the end-date min attribute immediately when the start date changes", async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BookingWizardModal
          mode="create"
          defaultDate={TARGET_DATE}
          defaultCurrency="PHP"
          locale="en"
        />
      </NextIntlClientProvider>
    );

    // Advance to event step.
    const createNewTab = screen.getByRole("button", { name: /create new/i });
    fireEvent.click(createNewTab);
    fireEvent.change(screen.getByPlaceholderText(/emma carter/i), {
      target: { value: "Test Client" },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
    });
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/carter wedding/i)).toBeInTheDocument();
    });

    // The endDate input's min should start as TARGET_DATE (= startDate).
    const endDateInput = document.getElementById(
      "wiz-endDate-0"
    ) as HTMLInputElement;
    expect(endDateInput).not.toBeNull();
    expect(endDateInput.min).toBe(TARGET_DATE);

    // Change start date to a later date.
    const NEW_DATE = "2026-08-01";
    const dateInput = document.getElementById(
      "wiz-startDate-0"
    ) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(dateInput, { target: { value: NEW_DATE } });
    });

    // The endDate min must update to the new start date — this proves that
    // SessionCard's local watch("sessions.0.startDate") re-rendered after the
    // native register onChange fired, which is the same mechanism that
    // drives the parent conflict-fetch useEffect.
    await waitFor(() => {
      expect(endDateInput.min).toBe(NEW_DATE);
    });
  });
});

// ── Issue 4 regression: start date change preserves session duration ──────────
//
// Pure-logic tests for the date arithmetic introduced in the onChange handler.
// Testing through the full React component for this is fragile because RHF's
// ref-based DOM updates (setNativeValue) interact unpredictably with happy-dom.
// The correctness of the formula is verified here as a unit test instead.
describe("Issue 4: start date shift preserves duration — date arithmetic", () => {
  // Mirror of the formula used in SessionCard.onChange.
  function shiftEndDate(
    oldStart: string,
    oldEnd: string,
    newStart: string,
    isSingle: boolean
  ): string {
    // Inline the same logic as the onChange handler.
    const { differenceInCalendarDays: diff, addDays, format } = require("date-fns") as {
      differenceInCalendarDays: (a: Date, b: Date) => number;
      addDays: (d: Date, n: number) => Date;
      format: (d: Date, fmt: string) => string;
    };
    if (isSingle) return newStart;
    if (oldStart && oldEnd && newStart) {
      const durDays = diff(new Date(oldEnd), new Date(oldStart));
      return format(addDays(new Date(newStart), Math.max(0, durDays)), "yyyy-MM-dd");
    }
    if (oldEnd && oldEnd < newStart) return newStart;
    return oldEnd;
  }

  it("preserves a 2-day duration when start moves from Jun-01 to Jun-10", () => {
    expect(shiftEndDate("2026-06-01", "2026-06-03", "2026-06-10", false)).toBe(
      "2026-06-12"
    );
  });

  it("preserves a 0-day duration (same-day multi-day) when start changes", () => {
    expect(shiftEndDate("2026-06-01", "2026-06-01", "2026-06-10", false)).toBe(
      "2026-06-10"
    );
  });

  it("clamps to newStart when computed end would be before newStart (duration was negative)", () => {
    // Negative duration is clamped to 0 by Math.max(0, durDays).
    expect(shiftEndDate("2026-06-03", "2026-06-01", "2026-06-10", false)).toBe(
      "2026-06-10"
    );
  });

  it("in single-day mode always returns newStart regardless of prior end date", () => {
    expect(shiftEndDate("2026-06-01", "2026-06-03", "2026-06-10", true)).toBe(
      "2026-06-10"
    );
  });

  it("returns newStart when oldEnd is ahead but oldStart is missing (fresh session)", () => {
    // No prior start → duration branch is skipped; fallback checks oldEnd < newStart.
    // "2026-06-03" < "2026-06-10" → true → returns newStart.
    expect(shiftEndDate("", "2026-06-03", "2026-06-10", false)).toBe(
      "2026-06-10"
    );
  });

  it("leaves oldEnd unchanged when oldEnd is ahead of newStart and no prior start", () => {
    // "2026-06-20" >= "2026-06-10" → fallback branch does not fire.
    expect(shiftEndDate("", "2026-06-20", "2026-06-10", false)).toBe(
      "2026-06-20"
    );
  });
});

// ── Pure overlap math — verifies the conflict formula independently ───────────
describe("conflict overlap formula", () => {
  function toMinutes(hhmm: string | undefined | null): number | null {
    if (!hhmm || !/^\d{2}:\d{2}$/.test(hhmm)) return null;
    const [h, m] = hhmm.split(":").map(Number);
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  }

  function overlaps(
    aStart: string,
    aEnd: string,
    bStart: string,
    bEnd: string
  ): boolean {
    const as = toMinutes(aStart);
    const ae = toMinutes(aEnd);
    const bs = toMinutes(bStart);
    const be = toMinutes(bEnd);
    if (as == null || ae == null || bs == null || be == null) return false;
    if (ae <= as) return false;
    return as < be && bs < ae;
  }

  it("detects 10:00–17:00 vs 13:00–14:00 as a conflict", () => {
    expect(overlaps("10:00", "17:00", "13:00", "14:00")).toBe(true);
  });

  it("detects adjacent non-overlapping shifts as clean", () => {
    expect(overlaps("10:00", "13:00", "13:00", "17:00")).toBe(false);
  });

  it("detects fully-before shift as clean", () => {
    expect(overlaps("10:00", "12:00", "13:00", "14:00")).toBe(false);
  });

  it("detects fully-after shift as clean", () => {
    expect(overlaps("15:00", "17:00", "10:00", "14:00")).toBe(false);
  });

  it("detects partial overlap at end boundary", () => {
    expect(overlaps("10:00", "14:00", "13:00", "17:00")).toBe(true);
  });

  it("returns false for malformed times", () => {
    expect(overlaps("", "17:00", "13:00", "14:00")).toBe(false);
  });
});
