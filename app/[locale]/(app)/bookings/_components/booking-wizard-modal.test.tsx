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
