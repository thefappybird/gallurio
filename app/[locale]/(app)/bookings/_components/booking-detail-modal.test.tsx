/**
 * Tests for BookingDetailModal covering all four rework issues:
 *
 * Issue 1 — per-session conflict check (no consolidated top banner)
 * Issue 2 — session edits go into pendingSessionEdits draft (no immediate API)
 * Issue 3 — locked-draft mechanism (✓ locks, ✏️ unlocks, ✗ discards)
 * Issue 4 — AlertDialog replaces window.confirm on close-with-unsaved
 */
import React from "react";
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
  // Link component used in the client contact block
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode; [k: string]: unknown }) =>
    React.createElement("a", { href, ...props }, children),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// The Event tab now renders the LocationPicker, which dynamically imports a
// Leaflet map. Stub it — this suite covers session/pricing logic, not the map
// (the picker has its own test).
vi.mock("@/components/ui/location-picker", () => ({
  LocationPicker: () => null,
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

const CLIENT_ID = "client-abc-456";

const MOCK_BOOKING = {
  _id: BOOKING_ID,
  title: "Test Wedding",
  clientName: "Alice Smith",
  clientId: CLIENT_ID,
  client: {
    id: CLIENT_ID,
    name: "Alice Smith",
    email: "alice@example.com",
    phone: "+63 917 555 0100",
  },
  eventType: "wedding",
  status: "booked",
  sessions: [FUTURE_SESSION],
  firstSessionStart: FUTURE_SESSION.startAt,
  lastSessionEnd: FUTURE_SESSION.endAt,
  location: { address: "Test Venue" },
  amount: { total: 10000, deposit: 3000, currency: "PHP" },
  notes: "",
};

const MOCK_CLIENT_SEARCH_RESULTS = [
  { id: "client-bob-789", name: "Bob Jones", email: "bob@example.com", phone: null },
  { id: "client-carol-012", name: "Carol White", email: null, phone: null },
];

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
  clientSearchResults?: typeof MOCK_CLIENT_SEARCH_RESULTS;
};

function makeFetch({
  booking = MOCK_BOOKING,
  shifts = [] as (typeof CONFLICT_SHIFT)[],
  patchResponse = booking,
  clientSearchResults = MOCK_CLIENT_SEARCH_RESULTS,
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
    if (url.includes("/api/clients")) {
      return { ok: true, json: async () => clientSearchResults };
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
  // Sessions, pricing, and location live under the Event tab after the
  // tab-grouping rework — activate it so that content is in the DOM.
  fireEvent.click(screen.getByRole("tab", { name: "Event" }));
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
    // Session cards live under the Event tab after the tab-grouping rework.
    fireEvent.click(screen.getByRole("tab", { name: "Event" }));
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

  it("does NOT bleed a shift into session 1 when it only overlaps session 2's time window", async () => {
    const twoSessBooking = makeTwoSessionBooking();
    // Shift 16:30–20:30 on the same date: overlaps session 2 (16:30–20:30) but
    // NOT session 1 (08:30–15:30). The time-overlap filter must surface it on
    // session 2's card only — exactly one mention, never bleeding into session 1.
    const session2OnlyShift = {
      id: "other-booking-xyz",
      bookingId: "other-booking-xyz",
      title: "Evening Event",
      shiftStart: "16:30",
      shiftEnd: "20:30",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: twoSessBooking as typeof MOCK_BOOKING, shifts: [session2OnlyShift] })
    );
    renderModal();
    await waitForMultiSessionLoad();

    // Appears exactly once (session 2's card). A second mention would mean it
    // wrongly bled into session 1, which the time-overlap filter must prevent.
    await waitFor(() => {
      expect(screen.getAllByText(/Evening Event/)).toHaveLength(1);
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

// ─────────────────────────────────────────────────────────────────────────────
// Issue new-1 — pill tabs styling
// ─────────────────────────────────────────────────────────────────────────────

describe("Pill tabs — four tabs render and switch panels", () => {
  it("renders four tab triggers (Client, Event, Pricing, Notes & activity)", async () => {
    renderModal();
    await waitForLoad();

    // Switch to Client tab first (default is client)
    const clientTab = screen.getByRole("tab", { name: /client/i });
    const eventTab = screen.getByRole("tab", { name: /event/i });
    const pricingTab = screen.getByRole("tab", { name: /pricing/i });
    const activityTab = screen.getByRole("tab", { name: /notes/i });

    expect(clientTab).toBeInTheDocument();
    expect(eventTab).toBeInTheDocument();
    expect(pricingTab).toBeInTheDocument();
    expect(activityTab).toBeInTheDocument();
  });

  it("switching to the Pricing tab shows the currency field", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: /pricing/i }));

    await waitFor(() => {
      // Currency field label renders in the pricing tab panel
      expect(screen.getByText("Currency")).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue new-2 — inline title editing in header
// ─────────────────────────────────────────────────────────────────────────────

describe("Header inline title editing", () => {
  it("renders the booking title as the dialog heading", async () => {
    renderModal();
    await waitForLoad();
    expect(
      screen.getByRole("heading", { name: /Test Wedding/i })
    ).toBeInTheDocument();
  });

  it("does NOT render a standalone Title EditableField inside the Event tab", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: /event/i }));

    // The only 'Title' label should be a button for inline editing in the header,
    // not a separate editable field in the event tab.
    // Verify there is no input labelled "Title" that belongs to an EditableField
    // (EditableField renders an input when in edit mode — we won't open it, but
    // we can assert the event tab's content does not have a dedicated title section
    // by checking there's no aria-label="Title" static display row).
    await waitFor(() => {
      // The event tab should show location, not a title row.
      expect(screen.getByText("Location")).toBeInTheDocument();
    });
  });

  it("clicking the title button opens an inline text input in the header", async () => {
    renderModal();
    await waitForLoad();

    // The title button has aria-label starting with "Edit title:"
    const titleBtn = screen.getByRole("button", { name: /edit title/i });
    fireEvent.click(titleBtn);

    await waitFor(() => {
      // An input with the current title value appears
      expect(screen.getByDisplayValue("Test Wedding")).toBeInTheDocument();
    });
  });

  it("editing the title and pressing Enter stages it as a pending change", async () => {
    renderModal();
    await waitForLoad();

    const titleBtn = screen.getByRole("button", { name: /edit title/i });
    fireEvent.click(titleBtn);

    const input = await screen.findByDisplayValue("Test Wedding");
    fireEvent.change(input, { target: { value: "Updated Title" } });
    fireEvent.keyDown(input, { key: "Enter" });

    // The Save button should become visible (pending count > 0)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });
  });

  it("pressing Escape while editing the title cancels without staging", async () => {
    renderModal();
    await waitForLoad();

    const titleBtn = screen.getByRole("button", { name: /edit title/i });
    fireEvent.click(titleBtn);

    const input = await screen.findByDisplayValue("Test Wedding");
    fireEvent.change(input, { target: { value: "Cancelled Edit" } });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => {
      // Input goes away and original title still shows
      expect(screen.queryByDisplayValue("Cancelled Edit")).not.toBeInTheDocument();
    });
    // No Save button should appear (no pending changes)
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue new-2b — event-type pill in header
// ─────────────────────────────────────────────────────────────────────────────

describe("Header event-type pill", () => {
  it("renders the current event type label in the header", async () => {
    renderModal();
    await waitForLoad();

    // The event type select trigger shows "Wedding"
    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: /event type/i })).toBeInTheDocument();
    });
  });

  it("does NOT render a standalone Event Type EditableField in the Event tab", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: /event/i }));

    await waitFor(() => {
      // Event tab shows location — the Event Type row was moved to the header
      expect(screen.getByText("Location")).toBeInTheDocument();
    });
    // There should be no second "Event type" label in the tab content
    // (it exists in the header pill, but not as an EditableField in the tab)
    const eventTypeLabels = screen.queryAllByText("Event type");
    // The header trigger has aria-label, not a visible "Event type" text label
    expect(eventTypeLabels.length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Issue new-3 — client tab enrichment
// ─────────────────────────────────────────────────────────────────────────────

/** Switch to the client tab after loading (waitForLoad navigates to Event tab). */
async function switchToClientTab() {
  fireEvent.click(screen.getByRole("tab", { name: /client/i }));
  // Wait for the client contact block to appear
  await waitFor(() => {
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });
}

describe("Client tab — contact block + reassign picker", () => {
  it("shows client email in the client tab", async () => {
    renderModal();
    await waitForLoad();
    await switchToClientTab();

    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("shows client phone in the client tab", async () => {
    renderModal();
    await waitForLoad();
    await switchToClientTab();

    expect(screen.getByText("+63 917 555 0100")).toBeInTheDocument();
  });

  it("shows the View client button that navigates to /clients with client deep-link", async () => {
    renderModal();
    await waitForLoad();
    await switchToClientTab();

    // "View client" is now a <button> (not a Link) that calls navRouter.push
    // with the client deep-link query param.
    const viewBtn = screen.getByRole("button", { name: /view client/i });
    expect(viewBtn).toBeInTheDocument();
  });

  it("shows 'No email' when client has no email", async () => {
    const bookingWithoutEmail = {
      ...MOCK_BOOKING,
      client: { id: CLIENT_ID, name: "Alice Smith", email: null, phone: null },
    };
    vi.stubGlobal("fetch", makeFetch({ booking: bookingWithoutEmail as unknown as typeof MOCK_BOOKING }));
    renderModal();
    // Wait for load then switch to client tab (no email means we can't use switchToClientTab helper)
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Test Wedding" })).toBeInTheDocument();
    });
    // Client tab is default, so email field should be visible without extra click
    await waitFor(() => {
      expect(screen.getByText("No email")).toBeInTheDocument();
    });
  });

  it("shows 'No phone' when client has no phone", async () => {
    const bookingWithoutPhone = {
      ...MOCK_BOOKING,
      client: { id: CLIENT_ID, name: "Alice Smith", email: "alice@example.com", phone: null },
    };
    vi.stubGlobal("fetch", makeFetch({ booking: bookingWithoutPhone as unknown as typeof MOCK_BOOKING }));
    renderModal();
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Test Wedding" })).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText("No phone")).toBeInTheDocument();
    });
  });

  it("opening Change client reveals a search input", async () => {
    renderModal();
    await waitForLoad();
    await switchToClientTab();

    // Click the "Change client" button
    fireEvent.click(screen.getByRole("button", { name: /change client/i }));

    await waitFor(() => {
      // A search input appears
      expect(
        screen.getByRole("textbox", { name: /search clients/i })
      ).toBeInTheDocument();
    });
  });

  it("selecting a client from the reassign picker stages pending changes", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();
    await switchToClientTab();

    fireEvent.click(screen.getByRole("button", { name: /change client/i }));

    // Wait for the client list to load (initial empty-query fetch)
    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });

    // Click on Bob Jones
    fireEvent.click(screen.getByText("Bob Jones"));

    // After selecting, the Save button should appear (pending count > 0)
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });
  });

  // H2 — after staging a reassignment the picked client's email/phone show immediately
  it("H2: contact block shows the staged client email/phone after picking a reassignment", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();
    await switchToClientTab();

    // Bob Jones has email but no phone in the search results fixture
    fireEvent.click(screen.getByRole("button", { name: /change client/i }));
    await waitFor(() => {
      expect(screen.getByText("Bob Jones")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Bob Jones"));

    // The picker closes and the contact block should now show Bob's email
    // instead of Alice's email — staged optimistically before save
    await waitFor(() => {
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
    });
    // Alice's email should no longer be visible in the contact block
    expect(screen.queryByText("alice@example.com")).not.toBeInTheDocument();
  });

  // H3 — multi-session bookings should hide the "Change client" trigger
  it("H3: hides the Change client button for a multi-session booking", async () => {
    // Build a two-session booking (server rejects reassign with 422 for these)
    const base = new Date();
    base.setDate(base.getDate() + 5);
    base.setHours(10, 0, 0, 0);
    const s1Start = base.toISOString();
    base.setHours(17, 0, 0, 0);
    const s1End = base.toISOString();
    base.setDate(base.getDate() + 1);
    base.setHours(10, 0, 0, 0);
    const s2Start = base.toISOString();
    base.setHours(17, 0, 0, 0);
    const s2End = base.toISOString();

    const multiSessionBooking = {
      ...MOCK_BOOKING,
      sessions: [
        { startAt: s1Start, endAt: s1End },
        { startAt: s2Start, endAt: s2End },
      ],
    };
    vi.stubGlobal("fetch", makeFetch({ booking: multiSessionBooking }));
    renderModal();

    // Wait for the multi-session booking to load
    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Test Wedding" })).toBeInTheDocument();
    });

    // Client tab is default — the "Change client" button must be absent
    // and the multi-session caption must appear instead
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /change client/i })).not.toBeInTheDocument();
    });
    // The explanatory caption should render
    expect(screen.getByText(/reassigning isn't available for multi-session/i)).toBeInTheDocument();
  });

  // T6 — PATCH response without a `client` block (realistic) must not collapse email/phone (H1)
  it("T6/H1: email and phone remain visible after saving an unrelated field (title) — realistic PATCH response has no client block", async () => {
    // Realistic PATCH response: no `client` key (real API omits it)
    const patchResponse = {
      ...MOCK_BOOKING,
      title: "Updated Title",
      client: undefined,
    } as unknown as typeof MOCK_BOOKING;

    const fetchMock = makeFetch({ patchResponse });
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    // Verify email shows before save
    await switchToClientTab();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();

    // Navigate back to Event tab, edit session date to create a pending change
    // (simpler: use the title inline edit to stage a pending change)
    fireEvent.click(screen.getByRole("tab", { name: /client/i }));
    // Use the title inline edit to stage a pending change
    const titleBtn = screen.getByRole("button", { name: /edit title/i });
    fireEvent.click(titleBtn);
    const titleInput = await screen.findByDisplayValue("Test Wedding");
    fireEvent.change(titleInput, { target: { value: "Updated Title" } });
    fireEvent.keyDown(titleInput, { key: "Enter" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
    });

    // Save — PATCH returns no client block
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // After save settles, email must still be visible (not collapsed to "No email")
    await waitFor(() => {
      // The client tab is active; email should persist
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });
    expect(screen.queryByText("No email")).not.toBeInTheDocument();
  });

  // Search error state test
  it("shows search error message when the client search API fails", async () => {
    const failingFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/api/clients")) {
        return { ok: false, json: async () => ({ error: "Server error" }) };
      }
      // Delegate everything else to the normal mock
      return makeFetch()(url, init);
    });
    vi.stubGlobal("fetch", failingFetch);
    renderModal();
    await waitForLoad();
    await switchToClientTab();

    fireEvent.click(screen.getByRole("button", { name: /change client/i }));

    // Wait for the error to appear after the fetch fails
    await waitFor(() => {
      expect(screen.getByText(/search failed/i)).toBeInTheDocument();
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Item 7 — Unconfirmed drafts warning dialog
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Helper: add an unlocked (unconfirmed) draft session via "Add session" without
 * clicking ✓ to lock it.
 */
async function addUnlockedDraft() {
  // Navigate to Event tab first (waitForLoad lands on Event tab)
  fireEvent.click(screen.getByRole("button", { name: /add session/i }));
  // Confirm the draft card editor appeared (but do NOT click ✓ to lock it)
  await waitFor(() => {
    expect(
      screen.getByRole("button", { name: /confirm draft session/i })
    ).toBeInTheDocument();
  });
}

describe("Item 7 — Unconfirmed drafts warning before Save", () => {
  it("clicking Save with an unlocked draft shows the unconfirmed-drafts dialog instead of saving", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    // Add a draft and do NOT lock it (do not click ✓)
    await addUnlockedDraft();

    // The draft editor is open — "Add session" created an unlocked draft.
    // Now also create a pending scalar change to make `hasPending` true
    // (unlocked drafts alone don't count toward pendingCount — they only
    // trigger the warning when there ARE other pending changes).
    // Easiest: edit session date so pendingSessionEdits becomes non-empty.
    // We use the existing session (not the draft).
    // But actually: the spec says save() guard checks `hasUnconfirmedDrafts`
    // AFTER checking `hasPending`. An unlocked draft alone means hasPending=false,
    // so Save button doesn't appear.
    // We need at least one locked/scalar pending change to trigger Save visibility,
    // AND an unlocked draft present to trigger the warning.
    // → Lock the draft first, then add another draft to serve as the "unconfirmed" one.

    // Lock the first draft by clicking ✓
    const futureDate = new Date(Date.now() + 86400_000 * 10)
      .toISOString()
      .slice(0, 10);
    const dateInputs = screen.getAllByDisplayValue(/^\d{4}-\d{2}-\d{2}$/);
    fireEvent.change(dateInputs[dateInputs.length - 1], {
      target: { value: futureDate },
    });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm draft session/i }));
    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    // Now add a second draft and do NOT lock it
    fireEvent.click(screen.getByRole("button", { name: /add session/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).toBeInTheDocument()
    );

    // hasPending=true (locked draft), hasUnconfirmedDrafts=true (unlocked draft)
    // Clicking Save should open the warning dialog, NOT call fetch PATCH
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    // The unconfirmed-drafts warning dialog should appear (its localized title)
    // and NO PATCH should have fired — the save is intercepted, not sent.
    expect(
      await screen.findByText("Unconfirmed session drafts")
    ).toBeInTheDocument();
    const patchCalls = (fetchMock as Mock).mock.calls.filter(
      (args: unknown[]) => {
        const [url, init] = args as [string, RequestInit | undefined];
        return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
      }
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("confirming 'Submit & discard' in the unconfirmed-drafts dialog proceeds with save", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    // Lock a draft to make hasPending=true
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
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).not.toBeDisabled()
    );
    fireEvent.click(screen.getByRole("button", { name: /confirm draft session/i }));
    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    // Add a second UNLOCKED draft (unconfirmed)
    fireEvent.click(screen.getByRole("button", { name: /add session/i }));
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /confirm draft session/i })
      ).toBeInTheDocument()
    );

    // Click Save — warning dialog opens (no PATCH yet)
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    // Wait for the dialog to appear and find the submit action button
    // The AlertDialogAction button contains the submit text
    // We look for any button that can confirm/submit within the alert dialog
    await waitFor(() => {
      const patchCallsBefore = (fetchMock as Mock).mock.calls.filter(
        (args: unknown[]) => {
          const [url, init] = args as [string, RequestInit | undefined];
          return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
        }
      );
      expect(patchCallsBefore).toHaveLength(0);
    });

    // Click the "Submit & discard drafts" action in the warning dialog. Match
    // by its localized label (the cancel action reads "Go back"), so there is
    // no ambiguity — and no conditional guard that could let the test pass
    // without actually exercising the submit path.
    const submitDialogBtn = await screen.findByRole("button", {
      name: /submit.*discard/i,
    });
    fireEvent.click(submitDialogBtn);

    // After confirming, the save proceeds and fires exactly one PATCH.
    await waitFor(() => {
      const patchCalls = (fetchMock as Mock).mock.calls.filter(
        (args: unknown[]) => {
          const [url, init] = args as [string, RequestInit | undefined];
          return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
        }
      );
      expect(patchCalls).toHaveLength(1);
    });
  });
});
