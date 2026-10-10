import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { enMessages } from "@/test-utils/messages";
import type { CalendarEvent } from "../../bookings/_components/booking-calendar";
import { dayBoundInTz } from "@/lib/utils/timezone";
import { InquiriesCalendarManager } from "./inquiries-calendar-manager";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockInvalidateFor = vi.fn();
const mockVisible = vi.fn();
let mockPending = false;
const mockReschedule = vi.fn();

const stableParams = new URLSearchParams("view=calendar");
const stableRouter = { push: mockPush, refresh: mockRefresh, replace: vi.fn() };
vi.mock("next/navigation", () => ({ useSearchParams: () => stableParams }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => stableRouter,
  usePathname: () => "/inquiries",
}));
vi.mock("@/hooks/use-data-events", () => ({ useInvalidateFor: () => mockInvalidateFor }));
vi.mock("../../bookings/_components/_helpers/use-calendar-window-nav", () => ({
  useCalendarWindowNav: () => ({ onVisibleChange: mockVisible, isPending: mockPending }),
}));
vi.mock("../_actions", () => ({ rescheduleInquirySessionAction: (...a: unknown[]) => mockReschedule(...a) }));
vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn((p: Promise<unknown>, msgs: { error?: (e: unknown) => string }) => {
      p.catch((e) => msgs.error?.(e));
      return p;
    }),
  },
}));
vi.mock("../../bookings/_components/team-filter-control", () => ({ TeamFilterControl: () => null }));

type CalProps = {
  events: CalendarEvent[];
  onVisibleChange: (v: unknown) => void;
  messages: unknown;
  toolbarTrailing: unknown;
  draggableAccessor: unknown;
  onSelectEvent: unknown;
  emptyMessage?: string;
  defaultDate?: Date;
  onEventDrop: (a: { event: CalendarEvent; start: Date; end: Date }) => Promise<void>;
};
let cal: CalProps;
vi.mock("../../bookings/_components/booking-calendar-dynamic", () => ({
  InquiriesCalendarLazy: (props: CalProps) => {
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

function inquiryEvent(over: Partial<CalendarEvent> = {}): CalendarEvent {
  const start = new Date("2027-09-15T02:00:00Z");
  const end = new Date("2027-09-15T04:00:00Z");
  return {
    id: "inq1_s0_2027-09-15", bookingId: "inq1", teamId: null, title: "Cruz", start, end,
    status: "booked", clientName: "Cruz", rangeStart: start, rangeEnd: end, sessionIndex: 0,
    sessionStartAt: start, sessionEndAt: end, sessionDayCount: 1, sessionPastDayCount: 0,
    kind: "inquiry", inquiryId: "inq1", colorOverride: "var(--event-inquiry)", workspaceTz: "Asia/Manila",
    ...over,
  };
}

function ui(events: CalendarEvent[]) {
  return (
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <InquiriesCalendarManager
        events={events}
        locale="en"
        workspaceTz="Asia/Manila"
        window={{ start: "2027-08-01T00:00:00.000Z", end: "2027-10-31T00:00:00.000Z" }}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPending = false;
});

describe("InquiriesCalendarManager window navigation", () => {
  it("wires the window hook into the calendar and dims (aria-busy) the old candles while pending", () => {
    mockPending = true;
    const { container } = render(ui([inquiryEvent()]));
    expect(cal.onVisibleChange).toBe(mockVisible);
    expect(screen.getByText(/^Cruz@/)).toBeInTheDocument();
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveAttribute("aria-busy", "true");
    expect(wrapper.className).toContain("opacity-60");
  });
});

describe("InquiriesCalendarManager candle clicks", () => {
  it("inquiry candle opens via onOpenInquiry, with no router navigation", () => {
    const onOpenInquiry = vi.fn();
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <InquiriesCalendarManager events={[inquiryEvent()]} locale="en" onOpenInquiry={onOpenInquiry} />
      </NextIntlClientProvider>
    );
    act(() => (cal.onSelectEvent as (e: CalendarEvent) => void)(inquiryEvent()));
    expect(onOpenInquiry).toHaveBeenCalledWith("inq1");
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("booking candle pushes ?detail via the History API and drops inquiryId", () => {
    window.history.replaceState(null, "", "/en/inquiries?view=calendar&inquiryId=inq9");
    const pushState = vi.spyOn(window.history, "pushState");
    render(ui([inquiryEvent()]));
    act(() =>
      (cal.onSelectEvent as (e: CalendarEvent) => void)(
        inquiryEvent({ kind: "booking", inquiryId: undefined, bookingId: "b1" })
      )
    );
    expect(pushState).toHaveBeenCalledWith(window.history.state, "", "/en/inquiries?view=calendar&detail=b1");
    expect(mockPush).not.toHaveBeenCalled();
    pushState.mockRestore();
  });
});

describe("InquiriesCalendarManager ?date anchor", () => {
  // Workspace tz far from the runner tz: one of the two is >12h away from any runner offset.
  it.each(["Pacific/Kiritimati", "Pacific/Pago_Pago"])(
    "hands the calendar the requested wall date (Jan 10) regardless of browser tz (%s)",
    (tz) => {
      const noon = dayBoundInTz("2027-01-10", tz, 12, 0, 0, 0);
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <InquiriesCalendarManager
            events={[inquiryEvent()]}
            locale="en"
            workspaceTz={tz}
            window={{ start: "2027-08-01T00:00:00.000Z", end: "2027-10-31T00:00:00.000Z" }}
            defaultDate={noon}
          />
        </NextIntlClientProvider>
      );
      const d = cal.defaultDate!;
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2027, 0, 10]);
    }
  );
});

describe("InquiriesCalendarManager reschedule", () => {
  const droppedStart = new Date("2027-09-16T02:00:00Z");
  const droppedEnd = new Date("2027-09-16T04:00:00Z");

  it("success: invalidates via data events (no direct router.refresh) and keeps the moved candle in place", async () => {
    mockReschedule.mockResolvedValue({ ok: true, draftBookingId: "bk9" });
    render(ui([inquiryEvent()]));
    await act(async () => {
      await cal.onEventDrop({ event: inquiryEvent(), start: droppedStart, end: droppedEnd });
    });
    expect(mockInvalidateFor).toHaveBeenCalledTimes(1);
    expect(mockInvalidateFor).toHaveBeenCalledWith(
      { type: "inquiry.updated", inquiryId: "inq1", bookingId: "bk9" },
    );
    expect(mockRefresh).not.toHaveBeenCalled();
    // Server events have not changed yet -> override must still be applied (no snap-back).
    expect(screen.getByText(`Cruz@${droppedStart.toISOString()}`)).toBeInTheDocument();
  });

  it("clears the override only when a new events prop lands, then shows the server position", async () => {
    mockReschedule.mockResolvedValue({ ok: true });
    const view = render(ui([inquiryEvent()]));
    await act(async () => {
      await cal.onEventDrop({ event: inquiryEvent(), start: droppedStart, end: droppedEnd });
    });
    const serverStart = new Date("2027-09-17T02:00:00Z");
    view.rerender(ui([inquiryEvent({ start: serverStart, end: new Date("2027-09-17T04:00:00Z") })]));
    expect(screen.getByText(`Cruz@${serverStart.toISOString()}`)).toBeInTheDocument();
  });

  it("an unrelated events refresh mid-request keeps the in-flight override instead of snapping back", async () => {
    let resolveAction!: (v: unknown) => void;
    mockReschedule.mockReturnValue(new Promise((r) => (resolveAction = r)));
    const view = render(ui([inquiryEvent()]));
    let drop!: Promise<void>;
    await act(async () => {
      drop = cal.onEventDrop({ event: inquiryEvent(), start: droppedStart, end: droppedEnd });
    });
    view.rerender(ui([inquiryEvent(), inquiryEvent({ id: "inq2_s0_2027-09-15", inquiryId: "inq2", title: "Reyes" })]));
    expect(screen.getByText(`Cruz@${droppedStart.toISOString()}`)).toBeInTheDocument();
    expect(screen.getByText(/^Reyes@/)).toBeInTheDocument();
    await act(async () => {
      resolveAction({ ok: true });
      await drop;
    });
  });

  it("after success, an unrelated refresh still showing the old position keeps the override until the new position arrives", async () => {
    mockReschedule.mockResolvedValue({ ok: true });
    const view = render(ui([inquiryEvent()]));
    await act(async () => {
      await cal.onEventDrop({ event: inquiryEvent(), start: droppedStart, end: droppedEnd });
    });
    // Unrelated refresh lands first: the server copy still has the old position.
    view.rerender(ui([inquiryEvent(), inquiryEvent({ id: "inq2_s0_2027-09-15", inquiryId: "inq2", title: "Reyes" })]));
    expect(screen.getByText(`Cruz@${droppedStart.toISOString()}`)).toBeInTheDocument();
    // The reschedule's own refresh lands with the new position: override can go.
    view.rerender(ui([inquiryEvent({ start: droppedStart, end: droppedEnd })]));
    expect(screen.getByText(`Cruz@${droppedStart.toISOString()}`)).toBeInTheDocument();
    // A later teammate move is shown as-is (the override must not resurrect).
    const teammateStart = new Date("2027-09-20T02:00:00Z");
    view.rerender(ui([inquiryEvent({ start: teammateStart, end: new Date("2027-09-20T04:00:00Z") })]));
    expect(screen.getByText(`Cruz@${teammateStart.toISOString()}`)).toBeInTheDocument();
  });

  it("conflict error: reverts the candle and shows the conflict toast", async () => {
    mockReschedule.mockResolvedValue({ error: "conflict" });
    render(ui([inquiryEvent()]));
    await act(async () => {
      await cal.onEventDrop({ event: inquiryEvent(), start: droppedStart, end: droppedEnd });
    });
    expect(mockInvalidateFor).not.toHaveBeenCalled();
    expect(screen.getByText(`Cruz@${inquiryEvent().start.toISOString()}`)).toBeInTheDocument();
  });
});

describe("InquiriesCalendarManager stable props", () => {
  it("hands BookingCalendar referentially stable messages/toolbar/callbacks across an unrelated re-render", () => {
    const events = [inquiryEvent()];
    const view = render(ui(events));
    const first = {
      messages: cal.messages, trailing: cal.toolbarTrailing,
      drag: cal.draggableAccessor, select: cal.onSelectEvent,
    };
    view.rerender(ui(events));
    expect(cal.messages).toBe(first.messages);
    expect(cal.toolbarTrailing).toBe(first.trailing);
    expect(cal.draggableAccessor).toBe(first.drag);
    expect(cal.onSelectEvent).toBe(first.select);
  });
});

describe("InquiriesCalendarManager empty-period message", () => {
  it("offers the localized message when idle and withholds it while a window refetch is pending", () => {
    render(ui([]));
    expect(cal.emptyMessage).toBe("No inquiries in this period");
    mockPending = true;
    render(ui([]));
    expect(cal.emptyMessage).toBeUndefined();
  });
});
