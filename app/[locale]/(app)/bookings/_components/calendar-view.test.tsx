import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import { calendarWindow } from "@/lib/bookings/calendar-window";
import type { CalendarEvent } from "./booking-calendar";
import { CalendarView } from "./calendar-view";

const mockReplace = vi.fn();
const mockRefresh = vi.fn();
const mockInvalidateFor = vi.fn();
let search = "";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/lib/i18n/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn(), refresh: mockRefresh }),
  usePathname: () => "/bookings",
}));
vi.mock("@/hooks/use-data-events", () => ({
  useInvalidateFor: () => mockInvalidateFor,
}));
vi.mock("react-big-calendar", () => ({ Views: { MONTH: "month", WEEK: "week", DAY: "day" } }));
vi.mock("./booking-wizard-modal", () => ({ BookingWizardModal: () => null }));
vi.mock("./team-filter-control", () => ({ TeamFilterControl: () => null }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    promise: vi.fn(),
  }),
}));

type CalProps = {
  events: CalendarEvent[];
  onVisibleChange: (v: { date: Date; view: string }) => void;
  onEventDrop: (a: { event: CalendarEvent; start: Date; end: Date }) => Promise<void>;
  pendingIds: Set<string>;
  date: Date;
};
let cal: CalProps;
vi.mock("./booking-calendar", () => ({
  BookingCalendar: (props: CalProps) => {
    cal = props;
    return (
      <ul>
        {props.events.map((e) => (
          <li key={e.id}>{e.title}</li>
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
        initialClients={[]}
        workspaceTimezone={TZ}
        window={windowIso}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  search = "team=a";
});

describe("CalendarView window navigation", () => {
  it("outside the window: replaces ?date, keeps old candles rendered, reports pending", () => {
    const onWindowPendingChange = vi.fn();
    renderView({ onWindowPendingChange });
    act(() => cal.onVisibleChange({ date: new Date(2027, 0, 10, 12), view: "month" }));
    expect(mockReplace).toHaveBeenCalledWith("/bookings?team=a&date=2027-01-10", { scroll: false });
    expect(onWindowPendingChange).toHaveBeenCalledWith(true);
    expect(screen.getByText("Carter Wedding")).toBeInTheDocument();
  });

  it("follows a ?date that moves outside the visible grid (back button), ignores one inside it", () => {
    const first = new Date("2026-09-15T00:00:00Z");
    const view = renderView({ defaultDate: first });
    const rerender = (d: Date) =>
      view.rerender(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <CalendarView events={[makeEvent()]} messages={calMessages} initialClients={[]} workspaceTimezone={TZ} window={windowIso} defaultDate={d} />
        </NextIntlClientProvider>
      );
    const shownBefore = cal.date;
    rerender(new Date("2026-09-20T00:00:00Z"));
    expect(cal.date).toBe(shownBefore);
    const far = new Date("2027-01-10T00:00:00Z");
    rerender(far);
    expect(cal.date).toBe(far);
  });
});
