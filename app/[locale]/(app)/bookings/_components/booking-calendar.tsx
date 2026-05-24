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
  type DragFromOutsideItemArgs,
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

export type OverflowEvent = {
  type: "overflow";
  id: string;
  bookingId: string;
  title: string;
  start: Date;
  end: Date;
  status: "booked";
  clientName: string;
  clientEmail: null;
  rangeStart: Date;
  rangeEnd: Date;
  sessionIndex: 0;
  sessionStartAt: Date;
  sessionEndAt: Date;
  sessionDayCount: 1;
  sessionPastDayCount: 0;
  overflowCount: number;
  overflowEvents: CalendarEvent[];
};

const locales = {} as const;
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

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

/** Union of a real booking event and the synthetic overflow placeholder. */
export type AnyCalendarEvent = CalendarEvent | OverflowEvent;

const DnDCalendar = withDragAndDrop<AnyCalendarEvent>(Calendar);

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  defaultView?: View;
  onSelectEvent?: (event: CalendarEvent) => void;
  /** Called when the user clicks an empty cell or time slot.
   *  `time` is "HH:MM" and is provided in week/day view where the slot has
   *  a known time; absent for month-view day-cell clicks. */
  onSelectSlot?: (date: Date, time?: string) => void;
  onEventDrop?: (args: EventInteractionArgs<AnyCalendarEvent>) => void;
  onEventResize?: (args: EventInteractionArgs<AnyCalendarEvent>) => void;
  /** Called when the user begins dragging a hidden event from the overflow popover. */
  onExternalDragStart?: (event: CalendarEvent) => void;
  /** Called when an external drag ends (dropped or cancelled) so the popover can close. */
  onExternalDragEnd?: () => void;
  onDropFromOutside?: (args: DragFromOutsideItemArgs) => void;
  dragFromOutsideItem?: () => AnyCalendarEvent;
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

/** A single draggable row inside the overflow popover. */
function OverflowPopoverRow({
  event: e,
  onSelectEvent,
  onExternalDragStart,
  onExternalDragEnd,
  onClose,
}: {
  event: CalendarEvent;
  onSelectEvent?: (ev: CalendarEvent) => void;
  onExternalDragStart?: (ev: CalendarEvent) => void;
  onExternalDragEnd?: () => void;
  onClose: () => void;
}) {
  const rowRef = useRef<HTMLButtonElement>(null);
  const bg = STATUS_COLOR[e.status];
  return (
    <button
      ref={rowRef}
      key={e.id}
      type="button"
      draggable
      onDragStart={(evt) => {
        if (rowRef.current) {
          evt.dataTransfer.setDragImage(rowRef.current, 0, 0);
        }
        evt.dataTransfer.effectAllowed = "move";
        evt.dataTransfer.setData("text/plain", e.bookingId);
        onExternalDragStart?.(e);
      }}
      onDragEnd={() => {
        onExternalDragEnd?.();
        onClose();
      }}
      onClick={() => {
        onClose();
        onSelectEvent?.(e);
      }}
      className="flex flex-col items-start w-full px-2 py-1.5 text-left hover:bg-muted focus-visible:bg-muted active:bg-muted transition-colors cursor-grab active:cursor-grabbing"
      style={{ borderLeft: `3px solid ${bg}` }}
    >
      <span className="truncate text-xs font-semibold text-foreground w-full">
        {e.title}
      </span>
      <span className="truncate text-[10px] text-muted-foreground w-full">
        {e.clientName || "—"}
      </span>
      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
        {formatTimeRange(e.sessionStartAt, e.sessionEndAt)}
      </span>
    </button>
  );
}

/** Month view: three-line stacked — title / client / time range. */
export function MonthBookingEvent({
  event,
  onSelectEvent,
  onExternalDragStart,
  onExternalDragEnd,
}: EventProps<AnyCalendarEvent> & {
  onSelectEvent?: (ev: CalendarEvent) => void;
  onExternalDragStart?: (ev: CalendarEvent) => void;
  onExternalDragEnd?: () => void;
}) {
  const ev = event;
  const [open, setOpen] = useState(false);

  if ("type" in ev && ev.type === "overflow") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="w-full text-left"
              aria-label={`Show ${ev.overflowCount} more event${ev.overflowCount === 1 ? "" : "s"}`}
            />
          }
        >
          <span className="overflow-pill block w-full cursor-pointer bg-foreground text-background text-[10px] font-semibold leading-tight px-1.5 py-0.5">
            +{ev.overflowCount} more
          </span>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-56 p-2">
          <div className="flex flex-col gap-1">
            {ev.overflowEvents.map((e) => (
              <OverflowPopoverRow
                key={e.id}
                event={e}
                onSelectEvent={onSelectEvent}
                onExternalDragStart={onExternalDragStart}
                onExternalDragEnd={onExternalDragEnd}
                onClose={() => setOpen(false)}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  const booking = ev as CalendarEvent;
  const bg = STATUS_COLOR[booking.status];
  const clientDisplay = booking.clientName || "—";
  const timeRange = formatTimeRange(booking.start, booking.end);
  return (
    <span
      title={`${booking.title} · ${clientDisplay} · ${timeRange}`}
      className={`relative flex h-full w-full flex-col justify-center overflow-hidden pl-2 pr-1.5 py-0.5 text-white ${
        booking.status === "cancelled" || booking.status === "completed"
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
      <span className="truncate text-xs font-semibold leading-tight">{booking.title}</span>
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

// CalendarToolbar, TimeBookingEvent, and HoverableDayWrapper are module-level
// stable references. MonthBookingEvent needs onSelectEvent injected, so we
// build the month event component inside the parent via useMemo.

// ─── BookingCalendar ──────────────────────────────────────────────────────────

/**
 * Groups same-day events in month view so rbc renders at most one booking pill
 * per cell. Days with more than one event get a synthetic overflow placeholder
 * appended after the first event, listing all events for that day.
 *
 * Only applied in month view — week/day views have time-slot rows and can
 * display overlapping events without a cell-height cap.
 */
export function groupEventsForMonth(events: CalendarEvent[]): AnyCalendarEvent[] {
  const byDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = format(ev.start, "yyyy-MM-dd");
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(ev);
    } else {
      byDay.set(key, [ev]);
    }
  }

  const result: AnyCalendarEvent[] = [];
  for (const [, bucket] of byDay) {
    result.push(bucket[0]);
    if (bucket.length > 1) {
      const first = bucket[0];
      const overflow: OverflowEvent = {
        type: "overflow",
        id: `overflow_${format(first.start, "yyyy-MM-dd")}`,
        bookingId: "",
        title: `+${bucket.length - 1} more`,
        start: first.start,
        end: first.end,
        status: "booked",
        clientName: "",
        clientEmail: null,
        rangeStart: first.start,
        rangeEnd: first.end,
        sessionIndex: 0,
        sessionStartAt: first.start,
        sessionEndAt: first.end,
        sessionDayCount: 1,
        sessionPastDayCount: 0,
        overflowCount: bucket.length - 1,
        overflowEvents: bucket.slice(1),
      };
      result.push(overflow);
    }
  }
  return result;
}

export function BookingCalendar({
  events,
  defaultDate,
  defaultView = Views.MONTH,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  onExternalDragStart,
  onExternalDragEnd,
  onDropFromOutside,
  dragFromOutsideItem,
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

  // Pre-process events for month view: cap each day at 1 pill + overflow.
  // Week/day views receive all events unmodified.
  const displayEvents = useMemo<AnyCalendarEvent[]>(() => {
    if (view === Views.MONTH) return groupEventsForMonth(events);
    return events;
  }, [view, events]);

  // Build the components object here so we can bind onSelectEvent and the
  // external-drag callbacks to MonthBookingEvent without stale closures.
  const calendarComponents = useMemo(
    () => ({
      toolbar: CalendarToolbar,
      month: {
        event: (props: EventProps<AnyCalendarEvent>) => (
          <MonthBookingEvent
            {...props}
            onSelectEvent={onSelectEvent}
            onExternalDragStart={onExternalDragStart}
            onExternalDragEnd={onExternalDragEnd}
          />
        ),
      },
      week: { event: TimeBookingEvent, dayColumnWrapper: HoverableDayWrapper },
      day: { event: TimeBookingEvent, dayColumnWrapper: HoverableDayWrapper },
    }),
    [onSelectEvent, onExternalDragStart, onExternalDragEnd]
  );

  return (
    <CalendarToolbarCtx.Provider value={toolbarCtx}>
      <div ref={containerRef} className="h-[calc(100vh-14rem)] min-h-112 w-full">
        <DnDCalendar
          localizer={localizer}
          events={displayEvents}
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
          selectable
          resizable
          longPressThreshold={1}
          messages={calendarMessages}
          components={calendarComponents}
          onSelectEvent={(event) => {
            if ("type" in event && (event as OverflowEvent).type === "overflow") return;
            onSelectEvent?.(event as unknown as CalendarEvent);
          }}
          onSelectSlot={(slot) => {
            const d = new Date(slot.start);
            const isTimeView = view === Views.WEEK || view === Views.DAY;
            onSelectSlot?.(d, isTimeView ? slotTime(d) : undefined);
          }}
          onEventDrop={onEventDrop}
          onEventResize={onEventResize}
          onDropFromOutside={onDropFromOutside}
          dragFromOutsideItem={dragFromOutsideItem ?? undefined}
          eventPropGetter={(event) => {
            if ("type" in event && (event as OverflowEvent).type === "overflow") {
              return { className: "cursor-pointer overflow-event", style: { padding: 0, background: "transparent", border: "none" } };
            }
            const bg = STATUS_COLOR[(event as CalendarEvent).status];
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
