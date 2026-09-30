import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import type { CalendarEvent } from "../../bookings/_components/booking-calendar";
import { InquiriesCalendarManager } from "./inquiries-calendar-manager";

const mockPush = vi.fn();
const mockRefresh = vi.fn();
const mockInvalidateFor = vi.fn();
const mockVisible = vi.fn();
let mockPending = false;
const mockReschedule = vi.fn();

vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams("view=calendar") }));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh, replace: vi.fn() }),
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
  onEventDrop: (a: { event: CalendarEvent; start: Date; end: Date }) => Promise<void>;
};
let cal: CalProps;
vi.mock("../../bookings/_components/booking-calendar", () => ({
  BookingCalendar: (props: CalProps) => {
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
