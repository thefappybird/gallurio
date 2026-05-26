/**
 * Tests for BookingDetailModal covering all four rework issues:
 *
 * Issue 1 — per-session conflict check (no consolidated top banner)
 * Issue 2 — session edits go into pendingSessionEdits draft (no immediate API)
 * Issue 3 — locked-draft mechanism (✓ locks, ✏️ unlocks, ✗ discards)
 * Issue 4 — AlertDialog replaces window.confirm on close-with-unsaved
 */
import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { BookingDetailModal } from "./booking-detail-modal";

// ── Navigation stubs ─────────────────────────────────────────────────────────
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

vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/bookings",
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// ── Fixture data ─────────────────────────────────────────────────────────────

const BOOKING_ID = "booking-abc-123";

// Build a future session anchored at 10:00–17:00 local time to avoid midnight
// wrapping issues that would make draftEndTime < draftStartTime in validation.
function makeFutureSession(dayOffset = 3) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(10, 0, 0, 0);
  const startAt = d.toISOString();
  d.setHours(17, 0, 0, 0);
  const endAt = d.toISOString();
  return { startAt, endAt };
}

const FUTURE_SESSION = makeFutureSession(3);

const MOCK_BOOKING = {
  _id: BOOKING_ID,
  title: "Test Wedding",
  clientName: "Alice Smith",
  eventType: "wedding",
  status: "booked",
  sessions: [FUTURE_SESSION],
  firstSessionStart: FUTURE_SESSION.startAt,
  lastSessionEnd: FUTURE_SESSION.endAt,
  location: { address: "Test Venue" },
  amount: { total: 10000, deposit: 3000, currency: "PHP" },
  notes: "",
};

const CONFLICT_SHIFT = {
  id: "other-booking-id",
  title: "Other Event",
  shiftStart: "00:00",
  shiftEnd: "23:59",
};

type FetchOptions = {
  booking?: typeof MOCK_BOOKING;
  shifts?: typeof CONFLICT_SHIFT[];
  patchResponse?: typeof MOCK_BOOKING;
};

function makeFetch({
  booking = MOCK_BOOKING,
  shifts = [] as (typeof CONFLICT_SHIFT)[],
  patchResponse = booking,
}: FetchOptions = {}): Mock {
  return vi.fn(async (url: string, init?: RequestInit) => {
    if (url.includes(`/api/bookings/${BOOKING_ID}/activity`)) {
      return { ok: true, json: async () => ({ entries: [], total: 0 }) };
    }
    if (url.includes("/api/bookings/shifts-on-date")) {
      return { ok: true, json: async () => ({ shifts }) };
    }
    if (url === `/api/bookings/${BOOKING_ID}`) {
      if (!init || init.method !== "PATCH") {
        return { ok: true, json: async () => booking };
      }
      return { ok: true, json: async () => patchResponse };
    }
    return { ok: false, json: async () => ({}) };
  });
}

function renderModal() {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BookingDetailModal bookingId={BOOKING_ID} locale="en" />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeFetch());
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait until the booking title renders in the dialog header. */
async function waitForLoad() {
  await waitFor(() => {
    // The title appears as a DialogTitle (<h2>). Use heading role to be precise.
    expect(screen.getByRole("heading", { name: "Test Wedding" })).toBeInTheDocument();
  });
}

/** Click the inline-edit pencil for Session N (1-indexed). */
function clickEditSession(n: number) {
  const btn = screen.getByRole("button", {
    name: new RegExp(`edit session ${n}`, "i"),
  });
  fireEvent.click(btn);
}

/** Change the session date input to a future date offset by `dayOffset` days. */
function changeDateInput(currentDate: string, dayOffset: number) {
  const newDate = new Date(Date.now() + 86400_000 * dayOffset)
    .toISOString()
    .slice(0, 10);
  const input = screen.getByDisplayValue(currentDate);
  fireEvent.change(input, { target: { value: newDate } });
  return newDate;
}

/** Click the ✓ confirm button inside an open SessionCard editor.
 *  Waits for the button to become enabled first (conflict check may still be in
 *  flight immediately after opening the editor or changing the date input). */
async function clickConfirm() {
  const btn = screen.getByRole("button", { name: /^confirm$/i });
  await waitFor(() => {
    expect(btn).not.toBeDisabled();
  });
  fireEvent.click(btn);
}

/** Get the X (close) button from the modal header bar. */
function getHeaderCloseButton() {
  const header = screen.getByRole("heading", { name: "Test Wedding" })
    .closest("div")!.parentElement!;
  const buttons = within(header).getAllByRole("button");
  return buttons[buttons.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────

describe("BookingDetailModal — render", () => {
  it("renders the booking title in the dialog header after load", async () => {
    renderModal();
    await waitForLoad();
    expect(
      screen.getByRole("heading", { name: "Test Wedding" })
    ).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue 1 — per-session conflict check
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue 1 — per-session conflict check", () => {
  it("shows per-session conflict alert when shifts overlap the session time", async () => {
    vi.stubGlobal("fetch", makeFetch({ shifts: [CONFLICT_SHIFT] }));
    renderModal();
    await waitForLoad();

    await waitFor(() => {
      expect(screen.getByText(/Other Event/i)).toBeInTheDocument();
    });
  });

  it("shows exactly one conflict mention (inside the session card, not a separate banner)", async () => {
    vi.stubGlobal("fetch", makeFetch({ shifts: [CONFLICT_SHIFT] }));
    renderModal();
    await waitForLoad();

    await waitFor(() => {
      const mentions = screen.queryAllByText(/Other Event/i);
      expect(mentions).toHaveLength(1);
    });
  });

  it("shows no conflict when shifts array is empty", async () => {
    vi.stubGlobal("fetch", makeFetch({ shifts: [] }));
    renderModal();
    await waitForLoad();

    // Allow conflict fetch to settle.
    await waitFor(() => {
      expect(screen.queryByText(/Other Event/i)).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue 2 — session edits are deferred
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue 2 — session edits are deferred (pendingSessionEdits)", () => {
  it("shows the 'Unsaved' pill after editing a session without saving", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    clickEditSession(1);
    changeDateInput(FUTURE_SESSION.startAt.slice(0, 10), 5);
    await clickConfirm();

    await waitFor(() => {
      expect(screen.getByText("Unsaved")).toBeInTheDocument();
    });

    // No PATCH should have fired.
    const patchCalls = (fetchMock as Mock).mock.calls.filter(
      (args: unknown[]) => {
        const [url, init] = args as [string, RequestInit | undefined];
        return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
      }
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("fires a single PATCH with sessions payload when Save changes is clicked", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    clickEditSession(1);
    changeDateInput(FUTURE_SESSION.startAt.slice(0, 10), 5);
    await clickConfirm();

    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      const patchCalls = (fetchMock as Mock).mock.calls.filter(
        (args: unknown[]) => {
          const [url, init] = args as [string, RequestInit | undefined];
          return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
        }
      );
      expect(patchCalls).toHaveLength(1);
      const body = JSON.parse(
        ((patchCalls[0] as unknown[])[1] as RequestInit).body as string
      );
      expect(body).toHaveProperty("sessions");
    });
  });

  it("discards a pending session edit when ✗ (discard edit) is clicked", async () => {
    renderModal();
    await waitForLoad();

    clickEditSession(1);
    changeDateInput(FUTURE_SESSION.startAt.slice(0, 10), 5);
    await clickConfirm();

    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /discard edit/i })
    );

    await waitFor(() => {
      expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue 3 — locked-draft mechanism
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue 3 — locked-draft mechanism", () => {
  it("shows DraftSessionCard editor (with date input) after Add session", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: /add session/i }));

    // DraftSessionCard renders an editor with a date input.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).toBeInTheDocument();
    });
  });

  it("clicking ✓ on DraftSessionCard locks it to display mode with Unsaved pill", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: /add session/i }));

    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).toBeInTheDocument()
    );

    // Set a valid future date in the draft card.
    const futureDate = new Date(Date.now() + 86400_000 * 10)
      .toISOString()
      .slice(0, 10);
    // Get all date inputs — draft is always the last one.
    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(dateInputs[dateInputs.length - 1], {
      target: { value: futureDate },
    });

    // Wait for the conflict check to resolve before the button becomes enabled.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).not.toBeDisabled()
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirm draft session/i })
    );

    // Locked state: Unsaved pill appears, confirm-draft button is gone.
    await waitFor(() => {
      expect(screen.getByText("Unsaved")).toBeInTheDocument();
    });
    expect(
      screen.queryByRole("button", { name: /confirm draft session/i })
    ).not.toBeInTheDocument();
  });

  it("clicking ✏️ on a locked draft re-opens the editor", async () => {
    renderModal();
    await waitForLoad();

    // Add + lock a draft.
    fireEvent.click(screen.getByRole("button", { name: /add session/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).toBeInTheDocument()
    );

    const futureDate = new Date(Date.now() + 86400_000 * 10)
      .toISOString()
      .slice(0, 10);
    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(dateInputs[dateInputs.length - 1], {
      target: { value: futureDate },
    });
    // Wait for the conflict check to resolve before the button becomes enabled.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).not.toBeDisabled()
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirm draft session/i })
    );

    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    // Click ✏️ on Session 2 (the locked draft).
    fireEvent.click(
      screen.getByRole("button", { name: /edit session 2/i })
    );

    // Editor re-opens.
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).toBeInTheDocument();
    });
  });

  it("clicking ✗ on a locked draft removes it entirely", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: /add session/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).toBeInTheDocument()
    );

    const futureDate = new Date(Date.now() + 86400_000 * 10)
      .toISOString()
      .slice(0, 10);
    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(dateInputs[dateInputs.length - 1], {
      target: { value: futureDate },
    });
    // Wait for the conflict check to resolve before the button becomes enabled.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).not.toBeDisabled()
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirm draft session/i })
    );

    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    // Click ✗ (Remove session) on the locked draft — it's the X button on the
    // LockedDraftCard, which uses "Remove session" aria-label.
    const removeBtns = screen.getAllByRole("button", {
      name: /remove session/i,
    });
    // The existing session's remove is first; the draft's is last.
    fireEvent.click(removeBtns[removeBtns.length - 1]);

    await waitFor(() => {
      expect(screen.queryByText("Unsaved")).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue 4 — AlertDialog replaces window.confirm
// ─────────────────────────────────────────────────────────────────────────────

describe("Issue 4 — AlertDialog for close-with-unsaved", () => {
  it("does NOT call window.confirm when closing with pending changes", async () => {
    const confirmSpy = vi.fn(() => true);
    vi.stubGlobal("confirm", confirmSpy);
    renderModal();
    await waitForLoad();

    // Create a pending session edit.
    clickEditSession(1);
    changeDateInput(FUTURE_SESSION.startAt.slice(0, 10), 5);
    await clickConfirm();

    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    fireEvent.click(getHeaderCloseButton());

    expect(confirmSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.getByText("Discard changes?")).toBeInTheDocument();
    });
  });

  it("closes and clears pending state when 'Discard and close' is clicked", async () => {
    renderModal();
    await waitForLoad();

    clickEditSession(1);
    changeDateInput(FUTURE_SESSION.startAt.slice(0, 10), 5);
    await clickConfirm();

    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    fireEvent.click(getHeaderCloseButton());

    await waitFor(() =>
      expect(screen.getByText("Discard changes?")).toBeInTheDocument()
    );

    fireEvent.click(
      screen.getByRole("button", { name: /discard and close/i })
    );

    await waitFor(() => {
      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    });
  });

  it("returns to editing when 'Keep editing' is clicked in the discard dialog", async () => {
    renderModal();
    await waitForLoad();

    clickEditSession(1);
    changeDateInput(FUTURE_SESSION.startAt.slice(0, 10), 5);
    await clickConfirm();

    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    fireEvent.click(getHeaderCloseButton());

    await waitFor(() =>
      expect(screen.getByText("Discard changes?")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole("button", { name: /keep editing/i }));

    await waitFor(() => {
      expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
    });
    // Booking still open, Unsaved pill still present.
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Test Wedding" })
    ).toBeInTheDocument();
  });

  it("closes without the discard dialog when no changes are pending", async () => {
    renderModal();
    await waitForLoad();

    // No edits — direct close.
    fireEvent.click(getHeaderCloseButton());

    // No AlertDialog should appear.
    expect(screen.queryByText("Discard changes?")).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// False-conflict regression (sibling sessions + non-overlapping times)
// ─────────────────────────────────────────────────────────────────────────────

describe("False-conflict regression — time-overlap filtering", () => {
  /**
   * Builds a booking with two sessions on the SAME day: 08:30–15:30 and 16:30–20:30.
   * The shifts-on-date API should exclude both (same bookingId), but even if a shift
   * for the sibling session's time leaked through, the time-overlap filter must
   * reject it for session 1 (15:30 < 16:30 → no overlap).
   */
  function makeTwoSessionBooking() {
    const base = new Date();
    base.setDate(base.getDate() + 7);
    base.setHours(8, 30, 0, 0);
    const session1Start = base.toISOString();
    base.setHours(15, 30, 0, 0);
    const session1End = base.toISOString();
    base.setHours(16, 30, 0, 0);
    const session2Start = base.toISOString();
    base.setHours(20, 30, 0, 0);
    const session2End = base.toISOString();
    return {
      _id: BOOKING_ID,
      title: "Multi-Session Booking",
      clientName: "Client A",
      eventType: "wedding",
      status: "booked",
      sessions: [
        { startAt: session1Start, endAt: session1End },
        { startAt: session2Start, endAt: session2End },
      ],
      firstSessionStart: session1Start,
      lastSessionEnd: session2End,
      location: { address: "" },
      amount: { total: 0, deposit: 0, currency: "PHP" },
      notes: "",
    };
  }

  /** Wait for the multi-session booking heading to appear. */
  async function waitForMultiSessionLoad() {
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Multi-Session Booking" })
      ).toBeInTheDocument();
    });
  }

  it("does NOT show a conflict when the only shift on the date belongs to the same booking", async () => {
    const twoSessBooking = makeTwoSessionBooking();
    // Simulate the API leaking sibling session 2's data (same bookingId) — defense
    // in depth must suppress it.
    const siblingShift = {
      id: BOOKING_ID,
      bookingId: BOOKING_ID,
      title: "Sibling Session",
      shiftStart: "16:30",
      shiftEnd: "20:30",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: twoSessBooking as typeof MOCK_BOOKING, shifts: [siblingShift] })
    );
    renderModal();
    await waitForMultiSessionLoad();

    // Conflict alert must NOT appear for session 1 because the shift belongs to
    // the same booking.
    await waitFor(() => {
      expect(screen.queryByText(/Sibling Session/)).not.toBeInTheDocument();
    });
  });

  it("does NOT show a conflict when a shift on the same date does not overlap session 1's time window", async () => {
    const twoSessBooking = makeTwoSessionBooking();
    // Shift is 16:30–20:30 on the same date — no overlap with session 1 (08:30–15:30).
    const nonOverlappingShift = {
      id: "other-booking-xyz",
      bookingId: "other-booking-xyz",
      title: "Evening Event",
      shiftStart: "16:30",
      shiftEnd: "20:30",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: twoSessBooking as typeof MOCK_BOOKING, shifts: [nonOverlappingShift] })
    );
    renderModal();
    await waitForMultiSessionLoad();

    // No conflict should appear for session 1 — times don't overlap.
    await waitFor(() => {
      expect(screen.queryByText(/Evening Event/)).not.toBeInTheDocument();
    });
  });

  it("DOES show a conflict when a shift from another booking truly overlaps the session time", async () => {
    const twoSessBooking = makeTwoSessionBooking();
    // Shift 10:00–12:00 overlaps session 1 (08:30–15:30).
    const overlappingShift = {
      id: "other-booking-abc",
      bookingId: "other-booking-abc",
      title: "Morning Shoot",
      shiftStart: "10:00",
      shiftEnd: "12:00",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: twoSessBooking as typeof MOCK_BOOKING, shifts: [overlappingShift] })
    );
    renderModal();
    await waitForMultiSessionLoad();

    // Session 1's conflict alert must appear — 10:00–12:00 overlaps 08:30–15:30.
    await waitFor(() => {
      expect(screen.getByText(/Morning Shoot/)).toBeInTheDocument();
    });
  });

  it("does NOT flag back-to-back shifts as conflicts (boundary: session ends at 15:30, shift starts at 15:30)", async () => {
    const twoSessBooking = makeTwoSessionBooking();
    // Shift starts exactly when session 1 ends — strict half-open interval means no overlap.
    const backToBackShift = {
      id: "other-booking-btb",
      bookingId: "other-booking-btb",
      title: "Afternoon Event",
      shiftStart: "15:30",
      shiftEnd: "16:00",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: twoSessBooking as typeof MOCK_BOOKING, shifts: [backToBackShift] })
    );
    renderModal();
    await waitForMultiSessionLoad();

    await waitFor(() => {
      expect(screen.queryByText(/Afternoon Event/)).not.toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// pendingCount integrity
// ─────────────────────────────────────────────────────────────────────────────

describe("pendingCount — includes all pending types", () => {
  it("footer badge reflects a pending session edit", async () => {
    renderModal();
    await waitForLoad();

    clickEditSession(1);
    changeDateInput(FUTURE_SESSION.startAt.slice(0, 10), 5);
    await clickConfirm();

    await waitFor(() => {
      expect(screen.getByText(/1 unsaved/i)).toBeInTheDocument();
    });
  });

  it("footer badge reflects a locked draft", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: /add session/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).toBeInTheDocument()
    );

    const futureDate = new Date(Date.now() + 86400_000 * 10)
      .toISOString()
      .slice(0, 10);
    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(dateInputs[dateInputs.length - 1], {
      target: { value: futureDate },
    });
    // Wait for the conflict check to resolve before the button becomes enabled.
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).not.toBeDisabled()
    );
    fireEvent.click(
      screen.getByRole("button", { name: /confirm draft session/i })
    );

    await waitFor(() => {
      expect(screen.getByText(/1 unsaved/i)).toBeInTheDocument();
    });
  });
});
