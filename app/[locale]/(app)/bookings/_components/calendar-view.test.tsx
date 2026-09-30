import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { calendarWindow } from "@/lib/bookings/calendar-window";
import { dayBoundInTz } from "@/lib/utils/timezone";
import type { CalendarEvent } from "./booking-calendar";
import { CalendarView } from "./calendar-view";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();
const mockInvalidateFor = vi.fn();
let search = "";

// Like Next, hand back the same object until the query string changes.
let cachedParams: { key: string; value: URLSearchParams } | null = null;
vi.mock("next/navigation", () => ({
  useSearchParams: () => {
    if (cachedParams?.key !== search) cachedParams = { key: search, value: new URLSearchParams(search) };
    return cachedParams.value;
  },
}));
const mockRouter = { replace: mockReplace, push: vi.fn(), refresh: mockRefresh };
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/bookings",
}));
vi.mock("@/hooks/use-data-events", () => ({
  useInvalidateFor: () => mockInvalidateFor,
}));
vi.mock("./booking-wizard-modal", () => ({ BookingWizardModal: () => null }));
let wizardProps: { onClose: () => void } | null = null;
vi.mock("./booking-wizard-dynamic", () => ({
  BookingWizardLazy: (props: { onClose: () => void }) => {
    wizardProps = props;
    return null;
  },
}));
vi.mock("./team-filter-control", () => ({ TeamFilterControl: () => null }));
const toastErrors: string[] = [];
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn((m: string) => toastErrors.push(m)),
    promise: vi.fn((p: Promise<unknown>, msgs: { error?: (e: unknown) => string }) => {
      p.catch((e) => toastErrors.push(msgs.error?.(e) ?? ""));
      return p;
    }),
  }),
}));
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

type CalProps = {
  events: CalendarEvent[];
  onVisibleChange: (v: { date: Date; view: string }) => void;
  onEventDrop: (a: { event: CalendarEvent; start: Date; end: Date }) => Promise<void>;
  pendingIds: Set<string>;
  date: Date;
  toolbarTrailing: unknown;
  onSelectSlot: unknown;
  emptyMessage?: string;
};
let cal: CalProps;
vi.mock("./booking-calendar-dynamic", () => ({
  BookingCalendarLazy: (props: CalProps) => {
    cal = props;
    return (
      <ul>
        {props.events.map((e) => (
          <li key={e.id}>{`${e.title}@${e.start.toISOString()}`}</li>
        ))}
      </ul>
    );
  },
}));

const TZ = "Asia/Manila";
const w = calendarWindow(new Date("2026-09-15T04:00:00Z"), TZ);
const windowIso = { start: w.start.toISOString(), end: w.end.toISOString() };
const calMessages = {
  today: "Today", previous: "Prev", next: "Next", day: "Day", week: "Week", month: "Month",
  date: "Date", time: "Time", event: "Event", noEventsInRange: "None", goTo: "Go to",
  scrollToTime: "Scroll", go: "Go",
};

function makeEvent(over: Partial<CalendarEvent> = {}): CalendarEvent {
  const start = new Date("2026-09-15T10:00:00Z");
  const end = new Date("2026-09-15T12:00:00Z");
  return {
    id: "b1_s0_2026-09-15", bookingId: "b1", teamId: null, title: "Carter Wedding", start, end,
    status: "booked", clientName: "Emma", rangeStart: start, rangeEnd: end, sessionIndex: 0,
    sessionStartAt: start, sessionEndAt: end, sessionDayCount: 1, sessionPastDayCount: 0,
    workspaceTz: TZ, ...over,
  };
}

function renderView(props: Partial<React.ComponentProps<typeof CalendarView>> = {}) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <CalendarView
        events={[makeEvent()]}
        messages={calMessages}
        workspaceTimezone={TZ}
        window={windowIso}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  toastErrors.length = 0;
  search = "team=a";
});

describe("CalendarView window navigation", () => {
  it("outside the window: replaces ?date, keeps old candles rendered, reports pending", () => {
    const onWindowPendingChange = vi.fn();
    renderView({ onWindowPendingChange });
    act(() => cal.onVisibleChange({ date: new Date(2027, 0, 10, 12), view: "month" }));
    expect(mockReplace).toHaveBeenCalledWith("/bookings?team=a&date=2027-01-10", { scroll: false });
    expect(onWindowPendingChange).toHaveBeenCalledWith(true);
    expect(screen.getByText(/^Carter Wedding@/)).toBeInTheDocument();
  });

  it("closing the wizard keeps ?date (calendar stays on the month) and fires no RSC navigation", () => {
    search = "team=a&add=1&date=2027-01-10";
    window.history.replaceState(null, "", `/bookings?${search}`);
    renderView({ defaultDate: new Date("2027-01-10T04:00:00Z") });
    act(() => wizardProps!.onClose());
    expect(mockReplace).not.toHaveBeenCalled();
    expect(window.location.search).toBe("?team=a&date=2027-01-10");
  });

  // Workspace tz far from the runner tz: one of the two is >12h away from any runner offset.
  it.each(["Pacific/Kiritimati", "Pacific/Pago_Pago"])(
    "shows the requested wall date (Jan 10) when defaultDate is the workspace-tz noon instant (%s)",
    (tz) => {
      const noon = dayBoundInTz("2027-01-10", tz, 12, 0, 0, 0);
      renderView({ defaultDate: noon, workspaceTimezone: tz });
      expect([cal.date.getFullYear(), cal.date.getMonth(), cal.date.getDate()]).toEqual([2027, 0, 10]);
    }
  );

  it("follows a ?date that moves outside the visible grid (back button), ignores one inside it", () => {
    const first = new Date("2026-09-15T00:00:00Z");
    const view = renderView({ defaultDate: first });
    const rerender = (d: Date) =>
      view.rerender(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CalendarView events={[makeEvent()]} messages={calMessages} workspaceTimezone={TZ} window={windowIso} defaultDate={d} />
        </NextIntlClientProvider>
      );
    const shownBefore = cal.date;
    rerender(new Date("2026-09-20T00:00:00Z"));
    expect(cal.date).toBe(shownBefore);
    const far = new Date("2027-01-10T00:00:00Z");
    rerender(far);
    expect([cal.date.getFullYear(), cal.date.getMonth(), cal.date.getDate()]).toEqual([2027, 0, 10]);
  });
});

const FUTURE_START = new Date("2090-01-10T03:30:00Z");
const FUTURE_END = new Date("2090-01-10T05:30:00Z");
const futureEvent = () =>
  makeEvent({
    id: "b1_s0_2090-01-10",
    start: FUTURE_START, end: FUTURE_END, sessionStartAt: FUTURE_START, sessionEndAt: FUTURE_END,
    rangeStart: FUTURE_START, rangeEnd: FUTURE_END,
  });
const droppedStart = new Date("2090-01-11T03:30:00Z");
const droppedEnd = new Date("2090-01-11T05:30:00Z");
const shift = (bookingId: string, title: string) => ({
  id: `${bookingId}:0`, bookingId, sessionIndex: 0, title, shiftStart: "10:00", shiftEnd: "12:00",
});
const jsonRes = (status: number, body: unknown) => ({ ok: status < 400, status, json: async () => body });

describe("CalendarView drag-to-reschedule (single PATCH)", () => {
  it("409 conflict: one PATCH with rejectOnConflict, reverts the move, toasts the first title + count of the rest", async () => {
    mockFetch.mockResolvedValue(
      jsonRes(409, { error: "conflict", conflicts: [shift("o1", "Other"), shift("o1", "Other"), shift("o2", "Third")] })
    );
    renderView({ events: [futureEvent()] });
    await act(async () => {
      await cal.onEventDrop({ event: futureEvent(), start: droppedStart, end: droppedEnd });
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe("/api/bookings/b1");
    expect(JSON.parse(init.body).rejectOnConflict).toBe(true);
    expect(toastErrors).toEqual(['This time overlaps with "Other" and 1 other shift(s) — move cancelled']);
    expect(screen.getByText(`Carter Wedding@${FUTURE_START.toISOString()}`)).toBeInTheDocument();
  });

  it("409 completed_booking_read_only: reverts and shows the generic update error", async () => {
    mockFetch.mockResolvedValue(jsonRes(409, { error: "completed_booking_read_only" }));
    renderView({ events: [futureEvent()] });
    await act(async () => {
      await cal.onEventDrop({ event: futureEvent(), start: droppedStart, end: droppedEnd });
    });
    expect(toastErrors).toEqual(["Failed to update booking"]);
    expect(screen.getByText(`Carter Wedding@${FUTURE_START.toISOString()}`)).toBeInTheDocument();
  });

  it("200: rebuilds that booking's candles from the response, invalidates with the server's ids, never router.refresh", async () => {
    mockFetch.mockResolvedValue(
      jsonRes(200, {
        _id: "b1", title: "Carter Wedding", clientName: "Emma", clientId: "c9", createdFromInquiryId: "i7",
        teamId: null, status: "booked",
        sessions: [{ startAt: droppedStart.toISOString(), endAt: droppedEnd.toISOString() }],
        client: null,
      })
    );
    renderView({ events: [futureEvent()] });
    await act(async () => {
      await cal.onEventDrop({ event: futureEvent(), start: droppedStart, end: droppedEnd });
    });
    expect(screen.getByText(`Carter Wedding@${droppedStart.toISOString()}`)).toBeInTheDocument();
    expect(screen.queryByText(`Carter Wedding@${FUTURE_START.toISOString()}`)).toBeNull();
    expect(mockInvalidateFor).toHaveBeenCalledTimes(1);
    // Local candles are already rebuilt: no page refresh for the actor (other tabs get the socket).
    expect(mockInvalidateFor).toHaveBeenCalledWith(
      { type: "booking.updated", bookingId: "b1", clientId: "c9", inquiryId: "i7" },
      { refresh: false },
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    expect(cal.pendingIds.has("b1")).toBe(false);
  });
});

describe("CalendarView stable props", () => {
  it("passes referentially stable toolbarTrailing + onSelectSlot across an unrelated re-render", () => {
    const teams = [
      { id: "a", name: "A", color: "#111", isActive: true, isLead: true },
      { id: "b", name: "B", color: "#222", isActive: true, isLead: true },
    ] as never;
    const view = renderView({ teams });
    const first = { trailing: cal.toolbarTrailing, slot: cal.onSelectSlot };
    view.rerender(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CalendarView events={[makeEvent()]} messages={calMessages} workspaceTimezone={TZ} window={windowIso} teams={teams} />
      </NextIntlClientProvider>
    );
    expect(cal.toolbarTrailing).toBe(first.trailing);
    expect(cal.onSelectSlot).toBe(first.slot);
  });
});

describe("CalendarView empty-period message", () => {
  it("passes the localized empty message to the calendar when idle", () => {
    renderView();
    expect(cal.emptyMessage).toBe("No bookings in this period");
  });
});
