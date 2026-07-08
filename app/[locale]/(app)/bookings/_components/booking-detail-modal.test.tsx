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
import type { TimeMode } from "@/lib/utils/time-format";
import { BookingDetailModal } from "./booking-detail-modal";

// ── Time-format context stub ─────────────────────────────────────────────────
// Lets individual tests flip the saved time-format preference (mirrors the
// pattern used in booking-draft-card.test.tsx).
let _timeMode: TimeMode = "24h";
vi.mock("@/lib/time-format/context", () => ({
  useTimeFormat: vi.fn(() => _timeMode),
  useTimeFormatContext: vi.fn(() => ({ timeMode: _timeMode, setTimeMode: vi.fn() })),
  TimeFormatProvider: ({ children }: { children: React.ReactNode }) => children,
}));

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

// ── Client actions stub ───────────────────────────────────────────────────────
// NOTE: vi.mock factories are hoisted — use literals, not constants defined
// later in the file.
vi.mock("@/lib/actions/clients", () => ({
  getClientByIdAction: vi.fn().mockResolvedValue({
    id: "client-abc-456",
    name: "Alice Smith",
    email: "alice@example.com",
    phone: "+63 917 555 0100",
    source: "manual",
    tags: [],
    notes: "",
    totalSpent: 50000,
    bookingsCount: 1,
    lastBookingAt: null,
    isActive: true,
    currency: "PHP",
  }),
  getClientBookingsAction: vi.fn().mockResolvedValue([]),
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
  LocationDisplay: () => null,
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
  payments: [] as { price: number; status: "unpaid" | "paid"; createdAt: string; paidAt: string | null }[],
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

function renderModal(props: { businessComplete?: boolean; workspaceId?: string } = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BookingDetailModal bookingId={BOOKING_ID} locale="en" {...props} />
    </NextIntlClientProvider>
  );
}

function renderReadOnlyModal(booking = MOCK_BOOKING) {
  vi.stubGlobal("fetch", makeFetch({ booking }));
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <BookingDetailModal bookingId={BOOKING_ID} locale="en" readOnly />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.stubGlobal("fetch", makeFetch());
  vi.stubGlobal("confirm", vi.fn(() => true));
});

afterEach(() => {
  vi.unstubAllGlobals();
  _timeMode = "24h";
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Wait until the booking title renders in the dialog header. */
async function waitForLoad() {
  await waitFor(() => {
    // The title appears as a DialogTitle (<h2>). Use heading role to be precise.
    expect(screen.getByRole("heading", { name: "Test Wedding" })).toBeInTheDocument();
  });
  // Sessions live under the "Sessions" tab — activate it so that
  // session card content is in the DOM for tests that need it.
  fireEvent.click(screen.getByRole("tab", { name: "Sessions" }));
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

/** Get the X (close) button from the modal header bar. The heading sits inside
 *  a title+status flex row, which is itself inside the header's left column, so
 *  walk up two ancestors to reach the full header bar. */
function getHeaderCloseButton() {
  const header = screen.getByRole("heading", { name: "Test Wedding" })
    .closest("div")!.parentElement!.parentElement!;
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

  // Regression: an empty eventType/status resolves the i18n namespace root
  // (an object) rather than a leaf message, which fired a MISSING_MESSAGE
  // console error from next-intl's onError handler. safeT now short-circuits
  // on an empty key so no error is logged.
  it("does not log a MISSING_MESSAGE error when eventType and status are empty", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      makeFetch({
        booking: { ...MOCK_BOOKING, eventType: "", status: "" },
      })
    );

    renderModal();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Test Wedding" })
      ).toBeInTheDocument();
    });

    const missingMessageCalls = errorSpy.mock.calls.filter((args) =>
      args.some((a) => String(a).includes("MISSING_MESSAGE"))
    );
    expect(missingMessageCalls).toHaveLength(0);
    errorSpy.mockRestore();
  });

  // Regression: a non-empty but UNKNOWN eventType/status (e.g. "custom-thing",
  // "draft") must not produce a MISSING_MESSAGE console error either. safeT now
  // uses t.has() to gate the lookup so the onError logger is never triggered.
  it("does not log a MISSING_MESSAGE error when eventType and status are unknown values", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      makeFetch({
        booking: { ...MOCK_BOOKING, eventType: "custom-thing", status: "draft" },
      })
    );

    renderModal();
    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Test Wedding" })
      ).toBeInTheDocument();
    });

    const missingMessageCalls = errorSpy.mock.calls.filter((args) =>
      args.some((a) => String(a).includes("MISSING_MESSAGE"))
    );
    expect(missingMessageCalls).toHaveLength(0);
    errorSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Piece A — Download invoice/receipt button, gated on booking.payments
// ─────────────────────────────────────────────────────────────────────────────

describe("Download invoice/receipt button", () => {
  const PAID_PAYMENT = {
    price: 10000,
    status: "paid" as const,
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
  };

  it("renders Download receipt and opens the receipt route when completed with payments", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({
        booking: { ...MOCK_BOOKING, status: "completed", payments: [PAID_PAYMENT] },
      })
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderModal();
    await waitForLoad();

    const btn = screen.getByRole("button", { name: "Download receipt" });
    fireEvent.click(btn);
    expect(openSpy).toHaveBeenCalledWith(
      `/api/bookings/${BOOKING_ID}/receipt`,
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  });

  it("renders Download invoice and opens the invoice route when not completed with payments", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [PAID_PAYMENT] } })
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderModal();
    await waitForLoad();

    const btn = screen.getByRole("button", { name: "Download invoice" });
    fireEvent.click(btn);
    expect(openSpy).toHaveBeenCalledWith(
      `/api/bookings/${BOOKING_ID}/invoice`,
      "_blank",
      "noopener,noreferrer"
    );
    openSpy.mockRestore();
  });

  it("does not render when the booking has no payments", async () => {
    renderModal();
    await waitForLoad();

    expect(
      screen.queryByRole("button", { name: "Download invoice" })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Download receipt" })
    ).not.toBeInTheDocument();
  });
});

describe("Incomplete business warning", () => {
  const PAID_PAYMENT = {
    price: 10000,
    status: "paid" as const,
    createdAt: new Date().toISOString(),
    paidAt: new Date().toISOString(),
  };

  it("shows the incomplete-business warning dialog instead of downloading when business info is incomplete", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [PAID_PAYMENT] } })
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderModal({ businessComplete: false, workspaceId: "ws-1" });
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));

    await waitFor(() => {
      expect(screen.getByText("Business info incomplete")).toBeInTheDocument();
    });
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("clicking Cancel closes the warning dialog without downloading", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [PAID_PAYMENT] } })
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderModal({ businessComplete: false, workspaceId: "ws-1" });
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));
    await waitFor(() => {
      expect(screen.getByText("Business info incomplete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => {
      expect(screen.queryByText("Business info incomplete")).not.toBeInTheDocument();
    });
    expect(openSpy).not.toHaveBeenCalled();
    openSpy.mockRestore();
  });

  it("clicking Download anyway opens the PDF and does not set the localStorage flag", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [PAID_PAYMENT] } })
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderModal({ businessComplete: false, workspaceId: "ws-1" });
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));
    await waitFor(() => {
      expect(screen.getByText("Business info incomplete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Download anyway" }));

    expect(openSpy).toHaveBeenCalledWith(
      `/api/bookings/${BOOKING_ID}/invoice`,
      "_blank",
      "noopener,noreferrer"
    );
    expect(
      window.localStorage.getItem("gw_hide_incomplete_business_warning:ws-1")
    ).toBeNull();
    openSpy.mockRestore();
  });

  it("clicking Don't show this again sets the localStorage flag and downloads", async () => {
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [PAID_PAYMENT] } })
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderModal({ businessComplete: false, workspaceId: "ws-1" });
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));
    await waitFor(() => {
      expect(screen.getByText("Business info incomplete")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Don't show this again" }));

    expect(openSpy).toHaveBeenCalledWith(
      `/api/bookings/${BOOKING_ID}/invoice`,
      "_blank",
      "noopener,noreferrer"
    );
    expect(
      window.localStorage.getItem("gw_hide_incomplete_business_warning:ws-1")
    ).toBe("1");
    openSpy.mockRestore();
    window.localStorage.clear();
  });

  it("skips the warning dialog and downloads directly once the localStorage flag is set", async () => {
    window.localStorage.setItem("gw_hide_incomplete_business_warning:ws-1", "1");
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [PAID_PAYMENT] } })
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    renderModal({ businessComplete: false, workspaceId: "ws-1" });
    await waitForLoad();

    fireEvent.click(screen.getByRole("button", { name: "Download invoice" }));

    expect(openSpy).toHaveBeenCalledWith(
      `/api/bookings/${BOOKING_ID}/invoice`,
      "_blank",
      "noopener,noreferrer"
    );
    expect(screen.queryByText("Business info incomplete")).not.toBeInTheDocument();
    openSpy.mockRestore();
    window.localStorage.clear();
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
      payments: [] as { price: number; status: "unpaid" | "paid"; createdAt: string; paidAt: string | null }[],
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
    // Session cards live under the "Sessions" tab.
    fireEvent.click(screen.getByRole("tab", { name: "Sessions" }));
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

describe("Pill tabs — five tabs render and switch panels", () => {
  it("renders five tab triggers (Client, Event, Payments, Sessions, Notes & activity)", async () => {
    renderModal();
    await waitForLoad();

    const clientTab = screen.getByRole("tab", { name: /client/i });
    const eventTab = screen.getByRole("tab", { name: /^event$/i });
    const paymentsTab = screen.getByRole("tab", { name: /^payments$/i });
    const sessionsLocationTab = screen.getByRole("tab", { name: /^sessions$/i });
    const activityTab = screen.getByRole("tab", { name: /notes/i });

    expect(clientTab).toBeInTheDocument();
    expect(eventTab).toBeInTheDocument();
    expect(paymentsTab).toBeInTheDocument();
    expect(sessionsLocationTab).toBeInTheDocument();
    expect(activityTab).toBeInTheDocument();
  });

  it("uses a fixed five-column tab list so small screens do not need horizontal scrolling", async () => {
    renderModal();
    await waitForLoad();

    const tablist = screen.getByRole("tablist");
    expect(tablist.className).toContain("grid-cols-5");
    expect(tablist.className).not.toContain("overflow-x-auto");
  });

  it("switching to the Payments tab shows the currency field", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: /^payments$/i }));

    await waitFor(() => {
      // Currency field label renders in the Payments tab panel (moved off Event)
      expect(screen.getByText("Currency")).toBeInTheDocument();
    });
  });

  it("the Event tab no longer shows the currency field", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: /^event$/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /edit event type/i })).toBeInTheDocument();
    });
    expect(screen.queryByText("Currency")).not.toBeInTheDocument();
  });
});

describe("Read-only notes", () => {
  it("shows notes content but no edit control in read-only mode", async () => {
    renderReadOnlyModal({ ...MOCK_BOOKING, notes: "Inquiry note stays visible" });

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "Test Wedding" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: /notes/i }));

    expect(screen.getByText("Inquiry note stays visible")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit notes/i })).not.toBeInTheDocument();
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

  it("does NOT render a standalone Title EditableField inside the Sessions tab", async () => {
    renderModal();
    await waitForLoad();

    // waitForLoad already switches to Sessions tab — verify
    // Sessions tab shows schedule sections, not a title row.
    await waitFor(() => {
      // The SectionHeader "Schedule" should be present in this tab.
      expect(screen.getByText("Schedule")).toBeInTheDocument();
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

  it("stacks the header layout responsively and keeps the Edit all action accessible", async () => {
    renderModal();
    await waitForLoad();

    const heading = screen.getByRole("heading", { name: /Test Wedding/i });
    const headerRoot = heading.closest("div.border-b");
    expect(headerRoot?.className).toContain("flex-col");
    expect(headerRoot?.className).toContain("sm:flex-row");
    expect(screen.getByRole("button", { name: /edit all/i })).toBeInTheDocument();
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
// Issue new-2b — event-type control in the Event tab
// ─────────────────────────────────────────────────────────────────────────────

describe("Event tab — event-type field", () => {
  it("renders the event-type value as a pill with an edit button (no dropdown until clicked)", async () => {
    renderModal();
    await waitForLoad();

    // Switch to the Event tab
    fireEvent.click(screen.getByRole("tab", { name: /^event$/i }));

    // The event type shows as a read-only value + pencil edit button — the
    // dropdown is only mounted after the pencil is clicked (reveal pattern).
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /edit event type/i })
      ).toBeInTheDocument();
    });
    expect(screen.getByText("Wedding")).toBeInTheDocument();
    // No combobox should exist before the pencil is clicked.
    expect(
      screen.queryByRole("combobox", { name: /event type/i })
    ).not.toBeInTheDocument();
  });

  it("clicking the event-type pencil reveals the dropdown", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: /^event$/i }));

    const editBtn = await screen.findByRole("button", {
      name: /edit event type/i,
    });
    fireEvent.click(editBtn);

    // After clicking the pencil, the select control mounts.
    await waitFor(() => {
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });
  });

  it("does NOT render an event-type control in the header", async () => {
    renderModal();
    await waitForLoad();

    // The event type control is in the tab, not the header. The header only
    // contains: title button, status pill, outstanding badge, Edit All, close.
    const header = screen.getByRole("heading", { name: "Test Wedding" })
      .closest("div")!.parentElement!.parentElement!;
    const combosInHeader = within(header).queryAllByRole("combobox");
    const eventTypeCombosInHeader = combosInHeader.filter((el) =>
      el.getAttribute("aria-label")?.toLowerCase().includes("event type")
    );
    expect(eventTypeCombosInHeader).toHaveLength(0);
  });
});

describe("Header status pill", () => {
  it("renders status as a read-only pill in the header with the current label", async () => {
    renderModal();
    await waitForLoad();

    // Status is a button (pill) by default — not a combobox. MOCK_BOOKING.status
    // === "booked" → label "Booked" shows on the pill.
    const pill = await screen.findByRole("button", { name: /change status/i });
    expect(within(pill).getByText("Booked")).toBeInTheDocument();
    // No status combobox until the pencil is clicked.
    expect(
      screen.queryByRole("combobox", { name: /status/i })
    ).not.toBeInTheDocument();
  });

  it("clicking the status pill reveals the status dropdown", async () => {
    renderModal();
    await waitForLoad();

    const pill = await screen.findByRole("button", { name: /change status/i });
    fireEvent.click(pill);

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /status/i })
      ).toBeInTheDocument();
    });
  });

  it("removes the editable Client name and Status fields from the Client tab", async () => {
    renderModal();
    await waitForLoad(); // switches to the Event tab
    fireEvent.click(screen.getByRole("tab", { name: /client/i }));

    await waitFor(() => {
      // Contact block still shows the read-only client-name label.
      expect(screen.getByText("Client name")).toBeInTheDocument();
    });
    // Status moved to the header (aria-label, not visible text) — no "Status"
    // text/field remains in the body.
    expect(screen.queryAllByText("Status").length).toBe(0);
    // "Client name" appears only once now (the contact-block label); the
    // editable field that duplicated it was removed.
    expect(screen.queryAllByText("Client name").length).toBe(1);
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

  it("clicking View client opens the client detail modal stacked on top", async () => {
    renderModal();
    await waitForLoad();
    await switchToClientTab();

    const viewBtn = screen.getByRole("button", { name: /view client/i });
    expect(viewBtn).toBeInTheDocument();

    fireEvent.click(viewBtn);

    // The client detail modal should appear with the client's name and email.
    await waitFor(() => {
      // The client's name should appear in the stacked dialog.
      expect(screen.getAllByText("Alice Smith").length).toBeGreaterThan(0);
    });

    // The Edit button must NOT be present in the stacked modal (read-only view).
    // We find all dialog elements and check none has an "Edit" button.
    const dialogs = screen.getAllByRole("dialog");
    // The stacked client modal is the last dialog opened.
    const clientDialog = dialogs[dialogs.length - 1];
    const editBtnsInClientModal = within(clientDialog).queryAllByRole("button", {
      name: /^edit$/i,
    });
    expect(editBtnsInClientModal).toHaveLength(0);
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
      await screen.findByText("Unconfirmed changes")
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

    // Click the "Discard undrafted & save" action in the warning dialog. Match
    // by its localized label (the cancel action reads "Go back"), so there is
    // no ambiguity — and no conditional guard that could let the test pass
    // without actually exercising the submit path.
    const submitDialogBtn = await screen.findByRole("button", {
      name: /discard unconfirmed/i,
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

  // ── EditableField undrafted tests ──────────────────────────────────────────

  /**
   * Switch to the Payments tab and open the Deposit field's inline editor
   * WITHOUT clicking ✓ (leaving an undrafted change).
   */
  async function openDepositEditorWithoutConfirm(depositValue = "5000") {
    fireEvent.click(screen.getByRole("tab", { name: /^payments$/i }));
    await waitFor(() =>
      expect(screen.getByText("Deposit")).toBeInTheDocument()
    );
    // Click the pencil to open the Deposit field editor
    fireEvent.click(screen.getByRole("button", { name: /edit deposit/i }));
    await waitFor(() =>
      // The number input for the money field becomes visible
      expect(screen.getByRole("spinbutton")).toBeInTheDocument()
    );
    // Type a new value
    const input = screen.getByRole("spinbutton");
    fireEvent.change(input, { target: { value: depositValue } });
    // Do NOT click ✓ — editor stays open
  }

  it("EF-1: with a drafted Total change AND an open Deposit editor, clicking Save opens the warning dialog and fires no PATCH", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    // Switch to the Payments tab and draft the Total via ✓
    fireEvent.click(screen.getByRole("tab", { name: /^payments$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit total/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /edit total/i }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "12000" },
    });
    // Confirm the Total edit (✓)
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
    // hasPending should now be true (total changed)
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument()
    );

    // Now open the Deposit editor WITHOUT confirming
    await openDepositEditorWithoutConfirm("4000");

    // Click Save — the warning dialog must appear (open EditableField editor = undrafted)
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(screen.getByText("Unconfirmed changes")).toBeInTheDocument()
    );

    // No PATCH should have fired
    const patchCalls = (fetchMock as Mock).mock.calls.filter(
      (args: unknown[]) => {
        const [url, init] = args as [string, RequestInit | undefined];
        return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
      }
    );
    expect(patchCalls).toHaveLength(0);
  });

  it("EF-2: choosing 'Discard undrafted & save' closes the Deposit editor and fires one PATCH without the discarded deposit value", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    // Draft the Total via ✓ (Payments tab)
    fireEvent.click(screen.getByRole("tab", { name: /^payments$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit total/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /edit total/i }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "12000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument()
    );

    // Open Deposit editor without confirming
    await openDepositEditorWithoutConfirm("999");

    // Trigger the warning dialog
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByText("Unconfirmed changes")).toBeInTheDocument()
    );

    // Choose "Discard unconfirmed & save"
    fireEvent.click(screen.getByRole("button", { name: /discard unconfirmed/i }));

    // Deposit editor should close (no spinbutton for it / no ✓ button)
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /^confirm$/i })).not.toBeInTheDocument()
    );

    // Exactly one PATCH should fire, and its body must NOT include amount.deposit=999
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
      // Total change should be included
      expect(body).toHaveProperty("amount.total", 12000);
      // The discarded deposit (999) must NOT be in the body
      expect(body).not.toHaveProperty("amount.deposit", 999);
    });
  });

  it("EF-3: choosing 'Submit all changes' with a valid open Deposit editor fires one PATCH including the deposit value", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    // Draft the Total via ✓ (Payments tab)
    fireEvent.click(screen.getByRole("tab", { name: /^payments$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit total/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /edit total/i }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "12000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument()
    );

    // Open Deposit editor with a valid value (does not exceed total=12000)
    await openDepositEditorWithoutConfirm("4000");

    // Trigger the warning dialog
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByText("Unconfirmed changes")).toBeInTheDocument()
    );

    // Choose "Submit all changes"
    fireEvent.click(screen.getByRole("button", { name: /submit all changes/i }));

    // Exactly one PATCH, body includes both total and deposit
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
      expect(body).toHaveProperty("amount.total", 12000);
      expect(body).toHaveProperty("amount.deposit", 4000);
    });
  });

  it("EF-4: choosing 'Submit all changes' with an INVALID open Deposit editor (deposit > total) fires no PATCH and keeps the editor open", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    // toast.error is already mocked via sonner mock
    const { toast } = await import("sonner");
    renderModal();
    await waitForLoad();

    // Draft the Total via ✓ — keep it at 10000 (the MOCK_BOOKING default)
    fireEvent.click(screen.getByRole("tab", { name: /^payments$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit total/i })).toBeInTheDocument()
    );
    // Confirm the Total at the current default value so hasPending stays false for Total.
    // Instead, let's stage Total=10000 explicitly so hasPending=true.
    fireEvent.click(screen.getByRole("button", { name: /edit total/i }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], {
      target: { value: "15000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument()
    );

    // Open Deposit editor with an INVALID value (20000 > 15000 total)
    await openDepositEditorWithoutConfirm("20000");

    // Trigger the warning dialog
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByText("Unconfirmed changes")).toBeInTheDocument()
    );

    // Choose "Submit all changes" — should be blocked by validation
    fireEvent.click(screen.getByRole("button", { name: /submit all changes/i }));

    // No PATCH should fire
    await waitFor(() => {
      const patchCalls = (fetchMock as Mock).mock.calls.filter(
        (args: unknown[]) => {
          const [url, init] = args as [string, RequestInit | undefined];
          return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
        }
      );
      expect(patchCalls).toHaveLength(0);
    });

    // The error toast should have been called
    expect(toast.error).toHaveBeenCalled();

    // The Deposit editor should still be open (spinbutton still visible)
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("EF-5: submitting with an open Deposit editor while Total is 0 is blocked with 'Cannot add a deposit without setting a price'", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    const { toast } = await import("sonner");
    renderModal();
    await waitForLoad();

    // Draft Total down to 0 via ✓ (creates a pending edit so "Save changes"
    // renders — hasPending is only true once at least one field is
    // confirmed, an open-but-uncommitted editor alone doesn't trigger it,
    // same reason EF-1/EF-4 draft Total first).
    fireEvent.click(screen.getByRole("tab", { name: /^payments$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /edit total/i })).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /edit total/i }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton").length).toBeGreaterThan(0));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument()
    );

    // Open Deposit editor with a value while (pending) Total is 0.
    await openDepositEditorWithoutConfirm("500");

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(screen.getByText("Unconfirmed changes")).toBeInTheDocument()
    );
    fireEvent.click(screen.getByRole("button", { name: /submit all changes/i }));

    // No PATCH should fire
    await waitFor(() => {
      const patchCalls = (fetchMock as Mock).mock.calls.filter(
        (args: unknown[]) => {
          const [url, init] = args as [string, RequestInit | undefined];
          return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
        }
      );
      expect(patchCalls).toHaveLength(0);
    });

    expect(toast.error).toHaveBeenCalled();
    // The Deposit editor should still be open (spinbutton still visible)
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("clicking Save with an open (uncommitted) existing-session inline editor shows the warning dialog", async () => {
    // This test verifies that an open inline editor on an EXISTING session
    // (✓/✗ buttons visible, edit not yet confirmed) also counts as undrafted,
    // so the warning dialog appears and no PATCH fires.
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    // First create a confirmed pending change to make hasPending=true (the Save
    // button only appears when hasPending is true).  Editing a session date and
    // clicking ✓ pushes it into pendingSessionEdits.
    clickEditSession(1);
    changeDateInput(FUTURE_SESSION.startAt.slice(0, 10), 5);
    await clickConfirm();

    await waitFor(() =>
      expect(screen.getByText("Unsaved")).toBeInTheDocument()
    );

    // hasPending is now true (one pendingSessionEdit). Re-open the inline editor
    // for Session 1 WITHOUT confirming — this creates an open editor entry in
    // editingDraftDates keyed by "0" (existing session, no "draft:" prefix).
    clickEditSession(1);

    // The ✓ button for the inline editor should now be in the DOM (editor open).
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /^confirm$/i })).toBeInTheDocument();
    });

    // Click Save — the warning dialog must appear because there is an open
    // inline editor (undraftedCount > 0), and NO PATCH should fire yet.
    const saveBtn = screen.getByRole("button", { name: /save changes/i });
    fireEvent.click(saveBtn);

    // Warning dialog appears with "Unconfirmed changes" title.
    expect(
      await screen.findByText("Unconfirmed changes")
    ).toBeInTheDocument();

    // No PATCH should have fired — save was intercepted.
    const patchCalls = (fetchMock as Mock).mock.calls.filter(
      (args: unknown[]) => {
        const [url, init] = args as [string, RequestInit | undefined];
        return url === `/api/bookings/${BOOKING_ID}` && init?.method === "PATCH";
      }
    );
    expect(patchCalls).toHaveLength(0);
  });
});

describe("BookingDetailModal — time-format preference", () => {
  it("renders session timestamps in 12h AM/PM when the saved preference is 12h", async () => {
    _timeMode = "12h";
    renderModal();
    await waitForLoad();

    const sessionPanel = screen.getByRole("tabpanel", { name: "Sessions" });
    expect(within(sessionPanel).getAllByText(/\b(AM|PM)\b/).length).toBeGreaterThan(0);
  });

  it("renders session timestamps in 24h (no AM/PM) when the saved preference is 24h", async () => {
    _timeMode = "24h";
    renderModal();
    await waitForLoad();

    const sessionPanel = screen.getByRole("tabpanel", { name: "Sessions" });
    expect(within(sessionPanel).queryByText(/\b(AM|PM)\b/)).not.toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Payments section — draft add + Save
// ─────────────────────────────────────────────────────────────────────────────

describe("Payments section — empty state", () => {
  it("shows the empty-payments message centered above the Add payment button when there are no payments", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));

    await waitFor(() => {
      expect(
        screen.getByText("No payments scheduled yet for this booking")
      ).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /add payment/i })).toBeInTheDocument();
  });
});

describe("Payments section — title field", () => {
  it("typing a title on a draft payment includes it in the PATCH body on Save", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /add payment/i }));

    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Deposit installment" } });
    const priceInput = screen.getByLabelText("Price");
    fireEvent.change(priceInput, { target: { value: "500" } });

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
      expect(body.payments).toEqual([
        { price: 500, status: "unpaid", title: "Deposit installment" },
      ]);
    });
  });

  it("typing a title on an existing payment edit includes it in the PATCH body on Save", async () => {
    const EXISTING_PAYMENT = {
      price: 1000,
      status: "unpaid" as const,
      createdAt: new Date().toISOString(),
      paidAt: null,
      title: "",
    };
    const fetchMock = makeFetch({
      booking: { ...MOCK_BOOKING, payments: [EXISTING_PAYMENT] },
    });
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /edit payment 1/i }));

    const titleInput = screen.getByLabelText("Title");
    fireEvent.change(titleInput, { target: { value: "Final balance" } });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

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
      expect(body.payments).toEqual([
        { price: 1000, status: "unpaid", title: "Final balance" },
      ]);
    });
  });

  it("shows the payment's title as its primary label when set", async () => {
    const EXISTING_PAYMENT = {
      price: 1000,
      status: "unpaid" as const,
      createdAt: new Date().toISOString(),
      paidAt: null,
      title: "Booking fee",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [EXISTING_PAYMENT] } })
    );
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));

    await waitFor(() => {
      expect(screen.getByText("Booking fee")).toBeInTheDocument();
    });
  });
});

describe("Payments section — cap to remaining balance", () => {
  it("shows an inline error when a draft payment's price exceeds the remaining balance", async () => {
    // MOCK_BOOKING: total 10000, deposit 3000 → remaining balance 7000.
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /add payment/i }));

    const priceInput = screen.getByLabelText("Price");
    fireEvent.change(priceInput, { target: { value: "8000" } });

    await waitFor(() => {
      expect(screen.getByText("Exceeds remaining balance")).toBeInTheDocument();
    });
  });

  it("shows an inline error and disables Confirm when an existing payment's edited price exceeds the remaining balance", async () => {
    // total 10000, deposit 3000 → remaining balance (excluding this payment) 7000.
    const EXISTING_PAYMENT = {
      price: 1000,
      status: "unpaid" as const,
      createdAt: new Date().toISOString(),
      paidAt: null,
      title: "",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [EXISTING_PAYMENT] } })
    );
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /edit payment 1/i }));

    const priceInput = screen.getByLabelText("Price");
    fireEvent.change(priceInput, { target: { value: "8000" } });

    await waitFor(() => {
      expect(screen.getByText("Exceeds remaining balance")).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /^confirm$/i })).toBeDisabled();
  });

  it("disables the Add payment button once the remaining balance reaches zero", async () => {
    // total 10000, deposit 3000, one payment of 7000 → remaining balance 0.
    const FULL_PAYMENT = {
      price: 7000,
      status: "unpaid" as const,
      createdAt: new Date().toISOString(),
      paidAt: null,
      title: "",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [FULL_PAYMENT] } })
    );
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /add payment/i })).toBeDisabled();
    });
  });
});

describe("Payments section — delete existing payment", () => {
  it("removes an existing payment from the PATCH body on Save after clicking its delete button", async () => {
    const PAYMENT_0 = {
      price: 1000,
      status: "unpaid" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: null,
      title: "",
    };
    const PAYMENT_1 = {
      price: 2000,
      status: "unpaid" as const,
      createdAt: "2026-01-02T00:00:00.000Z",
      paidAt: null,
      title: "",
    };
    const fetchMock = makeFetch({
      booking: { ...MOCK_BOOKING, payments: [PAYMENT_0, PAYMENT_1] },
    });
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /delete payment 1/i }));

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
      expect(body.payments).toEqual([PAYMENT_1]);
    });
  });
});

describe("Payments section", () => {
  it("adds a draft payment via Add payment and includes it in the PATCH body on Save", async () => {
    const fetchMock = makeFetch();
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /add payment/i }));

    const priceInput = screen.getByLabelText("Price");
    fireEvent.change(priceInput, { target: { value: "500" } });

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
      expect(body.payments).toEqual([{ price: 500, status: "unpaid", title: "" }]);
    });
  });

  it("shows a Status control defaulting to Unpaid for a new draft payment", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /add payment/i }));

    const statusTrigger = screen.getByRole("combobox", { name: "Status" });
    expect(within(statusTrigger).getByText("Unpaid")).toBeInTheDocument();
  });

  it("clears a draft payment when Discard changes is clicked", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /add payment/i }));
    expect(screen.getByLabelText("Price")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /discard changes/i }));

    expect(screen.queryByLabelText("Price")).not.toBeInTheDocument();
  });

  it("removes a draft payment via its remove button", async () => {
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /add payment/i }));
    expect(screen.getByLabelText("Price")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /remove payment/i }));

    expect(screen.queryByLabelText("Price")).not.toBeInTheDocument();
  });

  it("edits an existing payment's price and includes the merged payments array in the PATCH body on Save", async () => {
    const EXISTING_PAYMENT = {
      price: 1000,
      status: "unpaid" as const,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    const fetchMock = makeFetch({
      booking: { ...MOCK_BOOKING, payments: [EXISTING_PAYMENT] },
    });
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /edit payment 1/i }));

    const priceInput = screen.getByLabelText("Price");
    fireEvent.change(priceInput, { target: { value: "2000" } });
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

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
      expect(body.payments).toEqual([{ price: 2000, status: "unpaid" }]);
    });
  });

  it("flips an existing payment from unpaid to paid via the existing-payment Status control and sends it in the PATCH body on Save", async () => {
    const EXISTING_PAYMENT = {
      price: 1000,
      status: "unpaid" as const,
      createdAt: new Date().toISOString(),
      paidAt: null,
    };
    const fetchMock = makeFetch({
      booking: { ...MOCK_BOOKING, payments: [EXISTING_PAYMENT] },
    });
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /edit payment 1/i }));

    const statusTrigger = screen.getByRole("combobox", { name: "Status" });
    fireEvent.click(statusTrigger);
    const paidOption = screen.getByRole("option", { name: "Paid" });
    fireEvent.pointerMove(paidOption);
    fireEvent.mouseOver(paidOption);
    fireEvent.mouseMove(paidOption);
    fireEvent.click(paidOption);
    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));

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
      expect(body.payments).toEqual([{ price: 1000, status: "paid" }]);
    });
  });

  it("edits payment index 1 of a 2-payment booking without corrupting index 0", async () => {
    const PAYMENT_0 = {
      price: 1000,
      status: "unpaid" as const,
      createdAt: "2026-01-01T00:00:00.000Z",
      paidAt: null,
    };
    const PAYMENT_1 = {
      price: 2000,
      status: "unpaid" as const,
      createdAt: "2026-01-02T00:00:00.000Z",
      paidAt: null,
    };
    const fetchMock = makeFetch({
      booking: { ...MOCK_BOOKING, payments: [PAYMENT_0, PAYMENT_1] },
    });
    vi.stubGlobal("fetch", fetchMock);
    renderModal();
    await waitForLoad();

    fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
    fireEvent.click(screen.getByRole("button", { name: /edit payment 2/i }));

    const priceInput = screen.getByLabelText("Price");
    fireEvent.change(priceInput, { target: { value: "3000" } });

    const statusTrigger = screen.getByRole("combobox", { name: "Status" });
    fireEvent.click(statusTrigger);
    const paidOption = screen.getByRole("option", { name: "Paid" });
    fireEvent.pointerMove(paidOption);
    fireEvent.mouseOver(paidOption);
    fireEvent.mouseMove(paidOption);
    fireEvent.click(paidOption);

    fireEvent.click(screen.getByRole("button", { name: /^confirm$/i }));
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
      expect(body.payments).toEqual([
        PAYMENT_0,
        { price: 3000, status: "paid" },
      ]);
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Outstanding balance — must reflect payments, not just total - deposit
// ─────────────────────────────────────────────────────────────────────────────

describe("Header outstanding balance", () => {
  it("does not reduce outstanding balance for an unpaid scheduled payment", async () => {
    // total 10000, deposit 3000 → outstanding stays 7000; an unpaid payment
    // isn't money in hand yet, so it must not clear the balance.
    const PAYMENT = {
      price: 2000,
      status: "unpaid" as const,
      createdAt: new Date().toISOString(),
      paidAt: null,
      title: "",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [PAYMENT] } })
    );
    renderModal();
    await waitForLoad();

    expect(screen.getByText("Outstanding balance: ₱7,000")).toBeInTheDocument();
  });

  it("subtracts a paid payment from total - deposit", async () => {
    // total 10000, deposit 3000, paid payment 2000 → outstanding 5000.
    const PAYMENT = {
      price: 2000,
      status: "paid" as const,
      createdAt: new Date().toISOString(),
      paidAt: new Date().toISOString(),
      title: "",
    };
    vi.stubGlobal(
      "fetch",
      makeFetch({ booking: { ...MOCK_BOOKING, payments: [PAYMENT] } })
    );
    renderModal();
    await waitForLoad();

    expect(screen.getByText("Outstanding balance: ₱5,000")).toBeInTheDocument();
  });
});
