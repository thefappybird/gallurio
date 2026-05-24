"use client";

import { createContext, forwardRef, useCallback, useContext, useMemo, useRef, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type View,
  type EventProps,
  type ToolbarProps,
} from "react-big-calendar";
import withDragAndDrop, {
  type EventInteractionArgs,
} from "react-big-calendar/lib/addons/dragAndDrop";
import { format, parse, startOfWeek, getDay } from "date-fns";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";

const locales = {} as const;
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const DnDCalendar = withDragAndDrop<CalendarEvent>(Calendar);

type BookingStatus = "inquiry" | "quoted" | "booked" | "completed" | "cancelled";

export type CalendarEvent = {
  /** Unique per rendered candle: `<bookingId>_s<sessionIdx>_<YYYY-MM-DD>`. */
  id: string;
  /** The underlying Booking._id — same across all per-day occurrences. Used
   *  when opening the detail modal. */
  bookingId: string;
  title: string;
  start: Date;
  end: Date;
  status: BookingStatus;
  clientName: string;
  clientEmail: string | null;
  /** First day of this session's date range. */
  rangeStart: Date;
  /** Last day of this session's date range. */
  rangeEnd: Date;
  /** Index of this session within booking.sessions[]. */
  sessionIndex: number;
  /** sessions[sessionIndex].startAt — shift-start of this session. */
  sessionStartAt: Date;
  /** sessions[sessionIndex].endAt — shift-end of this session. */
  sessionEndAt: Date;
  /** Total calendar days in this session (used for DnD prompt gate). */
  sessionDayCount: number;
  /** Days in this session that are strictly before today (used for past-aware
   *  shift logic in DnD). */
  sessionPastDayCount: number;
};

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  defaultView?: View;
  onSelectEvent?: (event: CalendarEvent) => void;
  /** Called when the user clicks an empty cell or time slot.
   *  `time` is "HH:MM" and is provided in week/day view where the slot has
   *  a known time; absent for month-view day-cell clicks. */
  onSelectSlot?: (date: Date, time?: string) => void;
  onEventDrop?: (args: EventInteractionArgs<CalendarEvent>) => void;
  onEventResize?: (args: EventInteractionArgs<CalendarEvent>) => void;
  messages: {
    today: string;
    previous: string;
    next: string;
    day: string;
    week: string;
    month: string;
    date: string;
    time: string;
    event: string;
    noEventsInRange: string;
    jumpTo: string;
    scrollToTime: string;
    go: string;
  };
};

// Status colors are theme-invariant — same hex/oklch in light AND dark so the
// calendar's color vocabulary is stable. White text on all of these.
const STATUS_COLOR: Record<BookingStatus, string> = {
  booked: "var(--event-booked)",
  quoted: "var(--event-quoted)",
  inquiry: "var(--event-inquiry)",
  completed: "var(--event-completed)",
  cancelled: "var(--event-cancelled)",
};

/**
 * Teams-style striped left edge — a CSS gradient that draws diagonal hashes
 * in a slightly lighter / darker tone of the candle's bg. Reads as a status
 * indicator without needing a separate color.
 */
function stripeBg(color: string): string {
  return `repeating-linear-gradient(135deg, color-mix(in oklch, ${color} 70%, white) 0 4px, transparent 4px 8px)`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTimeRange(start: Date, end: Date) {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

/** Month view: three-line stacked — title / client / time range. */
function MonthBookingEvent({ event }: EventProps<CalendarEvent>) {
  const ev = event;
  const bg = STATUS_COLOR[ev.status];
  const clientDisplay = ev.clientName || "—";
  const timeRange = formatTimeRange(ev.start, ev.end);
  return (
    <span
      title={`${ev.title} · ${clientDisplay} · ${timeRange}`}
      className={`relative flex h-full w-full flex-col justify-center overflow-hidden pl-2 pr-1.5 py-0.5 text-white ${
        ev.status === "cancelled" || ev.status === "completed"
          ? "line-through opacity-80"
          : ""
      }`}
      style={{ backgroundColor: bg }}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        aria-hidden
        style={{ background: stripeBg(bg) }}
      />
      <span className="truncate text-xs font-semibold leading-tight">{ev.title}</span>
      <span className="truncate text-[10px] leading-tight opacity-85">{clientDisplay}</span>
      <span className="whitespace-nowrap text-[10px] leading-tight opacity-85">{timeRange}</span>
    </span>
  );
}

/** Week/day view: three-line stacked — title / client / time range. */
function TimeBookingEvent({ event }: EventProps<CalendarEvent>) {
  const ev = event;
  const bg = STATUS_COLOR[ev.status];
  const clientDisplay = ev.clientName || "—";
  const timeRange = formatTimeRange(ev.start, ev.end);
  return (
    <div
      title={`${ev.title} · ${clientDisplay} · ${timeRange}`}
      className={`relative flex h-full w-full flex-col justify-start gap-0.5 overflow-hidden pl-2.5 pr-2 py-1.5 text-white ${
        ev.status === "cancelled" || ev.status === "completed"
          ? "line-through opacity-80"
          : ""
      }`}
      style={{ backgroundColor: bg }}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        aria-hidden
        style={{ background: stripeBg(bg) }}
      />
      <span className="truncate text-sm font-semibold leading-tight">{ev.title}</span>
      <span className="truncate text-[10px] leading-tight opacity-85">{clientDisplay}</span>
      <span className="whitespace-nowrap text-[10px] leading-tight opacity-85">{timeRange}</span>
    </div>
  );
}

function slotTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, "0")}:00`;
}

/**
 * Custom dayColumnWrapper for week/day views. CSS :hover can't reach
 * .rbc-timeslot-group because .rbc-events-container (position:absolute,
 * full-column) intercepts mouse events. Instead we track mouse Y on the
 * column itself and render a highlight div at z-index:-1 — behind events
 * but visible through their transparent containers.
 * isolation:isolate (set via CSS on .rbc-day-slot) keeps z-index:-1 contained
 * within the column stacking context so it never bleeds behind the page bg.
 */
const HoverableDayWrapper = forwardRef<
  HTMLDivElement,
  {
    children?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    slotMetrics?: { groups: unknown[] };
    date?: Date;
    resource?: unknown;
  }
>(function HoverableDayWrapper({ children, className, style, slotMetrics }, outerRef) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoverRow, setHoverRow] = useState<number | null>(null);
  const totalGroups = slotMetrics?.groups.length ?? 48;

  return (
    <div
      className={className}
      style={style}
      ref={(node) => {
        (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
        if (typeof outerRef === "function") outerRef(node);
        else if (outerRef)
          (outerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }}
      onMouseMove={(e) => {
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const row = Math.max(
          0,
          Math.min(
            totalGroups - 1,
            Math.floor(((e.clientY - rect.top) / rect.height) * totalGroups)
          )
        );
        if (row !== hoverRow) setHoverRow(row);
      }}
      onMouseLeave={() => setHoverRow(null)}
    >
      {children}
      {hoverRow !== null && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: `${(hoverRow / totalGroups) * 100}%`,
            height: `${(1 / totalGroups) * 100}%`,
            background: "color-mix(in oklch, var(--muted) 80%, transparent)",
            pointerEvents: "none",
            zIndex: -1,
          }}
        />
      )}
    </div>
  );
});

// ─── Custom toolbar ───────────────────────────────────────────────────────────

type CalendarToolbarCtxValue = {
  messages: Props["messages"];
  onScrollToHour: (h: number) => void;
};

/**
 * Context that provides messages and the imperative scroll handler to the
 * toolbar component. Using context (vs. a factory closure) keeps the toolbar
 * a stable module-level component so rbc never remounts it.
 */
const CalendarToolbarCtx = createContext<CalendarToolbarCtxValue | null>(null);

function CalendarToolbar({
  label,
  onNavigate,
  onView,
  view,
}: ToolbarProps<CalendarEvent>) {
  const ctx = useContext(CalendarToolbarCtx);
  const [jumpDate, setJumpDate] = useState("");
  const [jumpTime, setJumpTime] = useState("");

  if (!ctx) return null;
  const { messages, onScrollToHour } = ctx;
  const isTimeView = view === Views.WEEK || view === Views.DAY;

  const viewLabel: Record<string, string> = {
    month: messages.month,
    week: messages.week,
    day: messages.day,
  };

  function handleGo() {
    if (jumpDate) {
      const [y, m, d] = jumpDate.split("-").map(Number);
      // Use noon local time to avoid date-shifting from UTC offset.
      onNavigate("DATE", new Date(y, m - 1, d, 12, 0, 0));
    }
    if (jumpTime && isTimeView) {
      const [h] = jumpTime.split(":").map(Number);
      onScrollToHour(h);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
      {/* Navigation */}
      <div className="flex items-center">
        <Button
          variant="outline"
          size="icon-sm"
          className="min-h-11"
          onClick={() => onNavigate("PREV")}
          aria-label={messages.previous}
        >
          <ChevronLeftIcon className="size-4" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 border-x-0"
          onClick={() => onNavigate("TODAY")}
        >
          {messages.today}
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="min-h-11"
          onClick={() => onNavigate("NEXT")}
          aria-label={messages.next}
        >
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>

      {/* Date label — hidden on xs, visible sm+ */}
      <span className="hidden sm:block font-semibold text-sm">{label}</span>

      {/* Right: jump-to button + view switcher */}
      <div className="flex items-center gap-2">
        {/* Jump-to popover */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon-sm"
                className="min-h-11"
                aria-label={messages.jumpTo}
              />
            }
          >
            <CalendarIcon className="size-4" />
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-64 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {messages.jumpTo}
                </label>
                <input
                  type="date"
                  value={jumpDate}
                  onChange={(e) => setJumpDate(e.target.value)}
                  className="h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>
              {isTimeView && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {messages.scrollToTime}
                  </label>
                  <input
                    type="time"
                    value={jumpTime}
                    onChange={(e) => setJumpTime(e.target.value)}
                    className="h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  />
                </div>
              )}
              <Button size="sm" className="w-full min-h-11" onClick={handleGo}>
                {messages.go}
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* View switcher — button group (no gap, borders collapsed) */}
        <div className="flex">
          {([Views.MONTH, Views.WEEK, Views.DAY] as View[]).map((v, i) => (
            <Button
              key={v}
              variant={view === v ? "default" : "outline"}
              size="sm"
              className={`min-h-11${i > 0 ? " border-l-0" : ""}`}
              onClick={() => onView(v)}
            >
              {viewLabel[v] ?? v}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Stable components object — CalendarToolbar is module-level so rbc never
// remounts event components due to a reference change.
const CALENDAR_COMPONENTS = {
  toolbar: CalendarToolbar,
  month: { event: MonthBookingEvent },
  week: { event: TimeBookingEvent, dayColumnWrapper: HoverableDayWrapper },
  day: { event: TimeBookingEvent, dayColumnWrapper: HoverableDayWrapper },
};

// ─── BookingCalendar ──────────────────────────────────────────────────────────

export function BookingCalendar({
  events,
  defaultDate,
  defaultView = Views.MONTH,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  messages,
}: Props) {
  const [view, setView] = useState<View>(defaultView);
  const [date, setDate] = useState<Date>(defaultDate ?? new Date());

  // Open week/day view scrolled to 8 AM so business-hours bookings are
  // immediately visible. (rbc defaults to midnight otherwise.)
  const scrollToTime = useMemo(() => {
    const d = new Date();
    d.setHours(8, 0, 0, 0);
    return d;
  }, []);

  // Ref on the calendar wrapper — used for imperative .rbc-time-content scroll.
  const containerRef = useRef<HTMLDivElement>(null);

  const onScrollToHour = useCallback((h: number) => {
    const content = containerRef.current?.querySelector(
      ".rbc-time-content"
    ) as HTMLElement | null;
    if (content) {
      content.scrollTo({ top: (h / 24) * content.scrollHeight, behavior: "smooth" });
    }
  }, []);

  // Switching to week/day always snaps back to the current week/day so the
  // user doesn't end up stranded in a past or future period after browsing.
  const handleViewChange = useCallback((newView: View) => {
    setView(newView);
    if (newView === Views.WEEK || newView === Views.DAY) {
      setDate(new Date());
    }
  }, []);

  const toolbarCtx = useMemo<CalendarToolbarCtxValue>(
    () => ({ messages, onScrollToHour }),
    [messages, onScrollToHour]
  );

  const calendarMessages = useMemo(
    () => ({
      today: messages.today,
      previous: messages.previous,
      next: messages.next,
      day: messages.day,
      week: messages.week,
      month: messages.month,
      date: messages.date,
      time: messages.time,
      event: messages.event,
      noEventsInRange: messages.noEventsInRange,
    }),
    [messages]
  );

  return (
    <CalendarToolbarCtx.Provider value={toolbarCtx}>
      <div ref={containerRef} className="h-[calc(100vh-14rem)] min-h-112 w-full">
        <DnDCalendar
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          view={view}
          onView={handleViewChange}
          date={date}
          onNavigate={setDate}
          views={[Views.MONTH, Views.WEEK, Views.DAY]}
          scrollToTime={scrollToTime}
          step={30}
          timeslots={2}
          popup
          selectable
          resizable
          longPressThreshold={1}
          messages={calendarMessages}
          components={CALENDAR_COMPONENTS}
          onSelectEvent={(event) => onSelectEvent?.(event as CalendarEvent)}
          onSelectSlot={(slot) => {
            const d = new Date(slot.start);
            const isTimeView = view === Views.WEEK || view === Views.DAY;
            onSelectSlot?.(d, isTimeView ? slotTime(d) : undefined);
          }}
          onEventDrop={onEventDrop}
          onEventResize={onEventResize}
          eventPropGetter={(event) => {
            const ev = event as CalendarEvent;
            const bg = STATUS_COLOR[ev.status];
            return {
              className: "cursor-pointer",
              style: { borderColor: bg, padding: 0 },
            };
          }}
        />
      </div>
    </CalendarToolbarCtx.Provider>
  );
}
