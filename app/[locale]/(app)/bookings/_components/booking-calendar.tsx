"use client";

import { createContext, forwardRef, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useIsRtl } from "@/lib/i18n/rtl";
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
import { SegmentedToggle } from "@/components/ui/segmented-toggle";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import { formatTime, formatTimeRange, TIME_INPUT_LANG } from "@/lib/utils/time-format";
import { useTimeFormat } from "@/lib/time-format/context";
import { STATUS_COLOR_VAR as STATUS_COLOR, CONFLICT_COLOR_VAR } from "@/lib/bookings/status-style";
import { INACTIVE_TEAM_COLOR } from "@/lib/teams/team-colors";
import { escapeHtml } from "@/lib/email/escapeHtml";
import { FALLBACK_TZ } from "@/lib/utils/timezone";
import { toCalendarGridDate, fromCalendarGridDate } from "./_helpers/calendar-helpers";
import type { BookingStatus } from "@/lib/validators/booking";

export type OverflowEvent = {
  type: "overflow";
  id: string;
  start: Date;
  end: Date;
  overflowCount: number;
  overflowEvents: CalendarEvent[];
};

const locales = {} as const;
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

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
  /** Set by the midnight-split pass for week/day views. The evening half of an
   *  overnight candle (start → 23:59:59.999). */
  isEveningHead?: boolean;
  /** Set by the midnight-split pass for week/day views. The morning half of an
   *  overnight candle (00:00 → original end). */
  isMorningContinuation?: boolean;
  /** The team this booking belongs to, if any. Used for team-color mode. */
  teamId: string | null;
  /** Distinguishes inquiry candles from booking candles. Undefined = booking. */
  kind?: "inquiry" | "booking";
  /** Set only when kind === "inquiry". */
  inquiryId?: string;
  /** When set, overrides colorMode-based color. Used for inquiry candles. */
  colorOverride?: string;
  /** When true, this event's time window overlaps with another booking on the same day. */
  hasConflict?: boolean;
  /** Workspace IANA timezone. When set, session times are formatted in this timezone. */
  workspaceTz?: string;
};

/** Union of a real booking event and the synthetic overflow placeholder. */
export type AnyCalendarEvent = CalendarEvent | OverflowEvent;

const DnDCalendar = withDragAndDrop<AnyCalendarEvent>(Calendar);

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  defaultView?: View;
  /** Controlled view. When provided alongside `onViewChange`, the parent owns
   *  the current view so dialog-cancel remounts (key bumps) don't reset it. */
  view?: View;
  onViewChange?: (v: View) => void;
  /** Controlled current date — same rationale as `view`. */
  date?: Date;
  onDateChange?: (d: Date) => void;
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
  dragFromOutsideItem?: () => AnyCalendarEvent | null;
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
    goTo: string;
    scrollToTime: string;
    go: string;
  };
  /** When true, past candles render with opacity-60, title strikethrough, and a "Past" pill. */
  showPast?: boolean;
  /** Set of bookingIds that have an in-flight PATCH. Matching events are dimmed
   *  and made non-interactive so the user cannot drag the same event twice. */
  pendingIds?: Set<string>;
  /** "team" colors events by team; "status" (default) uses the status palette. */
  colorMode?: "status" | "team";
  /** Active-team id → hex color. Only consulted when colorMode is "team". */
  teamColorMap?: Record<string, string>;
  /** Optional content rendered in the toolbar immediately to the right of the Prev/Today/Next nav buttons. */
  toolbarTrailing?: ReactNode;
  /** Gate which events are draggable. When absent, all events are draggable
   *  (preserves current bookings-calendar behavior). */
  draggableAccessor?: (event: AnyCalendarEvent) => boolean;
  /** Workspace IANA timezone. Used as the fallback grid/positioning timezone
   *  for events that don't carry their own `workspaceTz` (e.g. booking-kind
   *  candles), and as the timezone used to translate react-big-calendar's
   *  drag/resize grid positions back to a real UTC instant. */
  workspaceTimezone?: string;
};

/**
 * Teams-style striped left edge — a CSS gradient that draws diagonal hashes
 * in a slightly lighter / darker tone of the candle's bg. Reads as a status
 * indicator without needing a separate color.
 */
function stripeBg(color: string): string {
  return `repeating-linear-gradient(135deg, color-mix(in oklch, ${color} 70%, white) 0 4px, transparent 4px 8px)`;
}

/** Build a candle-styled DOM element on the fly, append to body, return it.
 *  Used as the HTML5 drag image. Chrome refuses to snapshot offscreen React
 *  elements reliably, so we create a real on-screen (but visually negligible)
 *  node, point setDragImage at it, then remove it on the next animation
 *  frame — after the browser has already captured the bitmap. */
function buildDragGhost(args: {
  title: string;
  clientName: string;
  timeRange: string;
  bg: string;
}): HTMLDivElement {
  const ghost = document.createElement("div");
  ghost.setAttribute("aria-hidden", "true");
  ghost.style.cssText = [
    "position: fixed",
    "top: 0",
    "left: 0",
    "width: 192px",
    "height: 40px",
    "padding: 2px 6px 2px 8px",
    "display: flex",
    "flex-direction: column",
    "justify-content: center",
    "overflow: hidden",
    "color: white",
    "font-family: system-ui, sans-serif",
    `background-color: ${args.bg}`,
    "pointer-events: none",
    // Render on top, transparent so it doesn't flash the user before the
    // browser snapshots and detaches it. Keep z-index high so it's not
    // visually clipped by any stacking context behind it during capture.
    "opacity: 0.999",
    "z-index: 9999",
  ].join(";");
  ghost.innerHTML = `
    <div style="font-size:12px;font-weight:600;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(args.title)}</div>
    <div style="font-size:10px;line-height:1.2;opacity:0.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(args.clientName)}</div>
    <div style="font-size:10px;line-height:1.2;opacity:0.85;white-space:nowrap">${escapeHtml(args.timeRange)}</div>
  `;
  document.body.appendChild(ghost);
  return ghost;
}

/** A single draggable row inside the overflow popover.
 *  Builds a candle-styled ghost on dragstart, points setDragImage at it,
 *  then schedules its removal after the browser has captured the bitmap. */
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
  const ctx = useContext(CalendarToolbarCtx);
  const tStatus = useTranslations("app.bookings.statusValues");
  const timeMode = useTimeFormat();
  const bg = ctx ? ctx.eventColor(e) : (STATUS_COLOR[e.status] ?? "var(--muted)");
  const clientDisplay = e.clientName || "—";
  const timeRange = formatTimeRange(e.sessionStartAt, e.sessionEndAt, timeMode);
  return (
    <button
      key={e.id}
      type="button"
      draggable
      onDragStart={(evt) => {
        const ghost = buildDragGhost({
          title: e.title,
          clientName: clientDisplay,
          timeRange,
          bg,
        });
        evt.dataTransfer.setDragImage(ghost, 0, 0);
        // Remove after the browser has captured the bitmap.
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            ghost.remove();
          });
        });
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
      className="flex flex-col items-start w-full px-2 py-1.5 text-start hover:bg-muted focus-visible:bg-muted active:bg-muted transition-colors cursor-grab active:cursor-grabbing"
      style={{ borderInlineStart: `3px solid ${bg}` }}
    >
      <span className="truncate text-xs font-semibold text-foreground w-full">
        {e.title}
      </span>
      <span className="truncate text-[10px] text-muted-foreground w-full">
        {clientDisplay}
      </span>
      <span className="whitespace-nowrap text-[10px] text-muted-foreground">
        {timeRange}
      </span>
      <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-muted-foreground">
        <span
          aria-hidden
          className="size-1.5 shrink-0"
          style={{ backgroundColor: STATUS_COLOR[e.status] ?? "var(--muted)" }}
        />
        {typeof tStatus.has === "function" && !tStatus.has(e.status) ? e.status : tStatus(e.status)}
      </span>
    </button>
  );
}

/** Small "Past" badge overlaid in the top-right corner of a candle. */
function PastPill({ label }: { label: string }) {
  return (
    <span
      aria-label={label}
      className="absolute end-1 top-1 inline-flex items-center border border-white/40 bg-black/20 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white"
    >
      {label}
    </span>
  );
}

/** Status pill shown at the bottom-right of each candle: a status-color dot +
 *  label. For inquiry candles, `labelOverride` replaces the booking status text.
 *  Color-based conflict is conveyed via the candle background; the pill always
 *  shows the status label so color is not the sole signal. */
function StatusPill({
  status,
  label,
  labelOverride,
}: {
  status: BookingStatus;
  label: string;
  labelOverride?: string;
}) {
  return (
    <div className="pointer-events-none absolute bottom-0.5 end-0.5 z-10 flex items-center">
      <span className="inline-flex items-center gap-1 border border-border bg-background/95 px-1 py-px text-[9px] font-medium leading-tight text-foreground whitespace-nowrap">
        <span
          aria-hidden
          className="size-1.5 shrink-0"
          style={{ backgroundColor: STATUS_COLOR[status] ?? "var(--muted)" }}
        />
        {labelOverride ?? label}
      </span>
    </div>
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
  const ctx = useContext(CalendarToolbarCtx);
  const t = useTranslations("app.bookings.calendar");
  const tStatus = useTranslations("app.bookings.statusValues");
  const tInq = useTranslations("app.inquiries.statusValues");
  const timeMode = useTimeFormat();

  if ("type" in ev && ev.type === "overflow") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              className="w-full text-start"
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
  const baseBg = ctx ? ctx.eventColor(booking) : (STATUS_COLOR[booking.status] ?? "var(--muted)");
  const bg = booking.hasConflict ? CONFLICT_COLOR_VAR : baseBg;
  const clientDisplay = booking.clientName || "—";
  const timeRange = formatTimeRange(booking.start, booking.end, timeMode);
  const isPast = booking.end < new Date();
  const isStatusMuted =
    booking.status === "cancelled" || booking.status === "completed";
  const showPastVisual = isPast && !isStatusMuted && (ctx?.showPast ?? false);
  const statusLabel = typeof tStatus.has === "function" && !tStatus.has(booking.status) ? booking.status : tStatus(booking.status);
  const labelOverride = booking.kind === "inquiry" ? tInq("inquiry") : undefined;
  const candleAriaLabel = `${booking.title} · ${labelOverride ?? statusLabel}${booking.hasConflict ? " · conflict" : ""}`;

  return (
    <span
      title={`${booking.title} · ${clientDisplay} · ${timeRange}`}
      aria-label={candleAriaLabel}
      className={`relative flex h-full w-full flex-col justify-center overflow-hidden ps-2 pe-1.5 py-0.5 text-start text-white ${
        isStatusMuted
          ? "line-through opacity-80"
          : showPastVisual
          ? "opacity-60"
          : ""
      }`}
      style={{ backgroundColor: bg }}
    >
      <span
        className="absolute inset-y-0 start-0 w-1"
        aria-hidden
        style={{ background: stripeBg(bg) }}
      />
      <span
        className={`truncate text-xs font-semibold leading-tight${showPastVisual ? " line-through" : ""}`}
      >
        {booking.title}
      </span>
      <span className="truncate text-[10px] leading-tight opacity-85">{clientDisplay}</span>
      <span className="whitespace-nowrap text-[10px] leading-tight opacity-85">{timeRange}</span>
      {showPastVisual && <PastPill label={t("past")} />}
      <StatusPill
        status={booking.status}
        label={statusLabel}
        labelOverride={labelOverride}
      />
    </span>
  );
}

/** Week/day view: three-line stacked — title / client / time range. */
function TimeBookingEvent({ event }: EventProps<AnyCalendarEvent>) {
  // Hooks must be called unconditionally before any early return.
  const ctx = useContext(CalendarToolbarCtx);
  const t = useTranslations("app.bookings.calendar");
  const tStatus = useTranslations("app.bookings.statusValues");
  const tInq = useTranslations("app.inquiries.statusValues");
  const timeMode = useTimeFormat();
  // Overflow events never appear in week/day view (only month view produces them).
  // Guard defensively so the narrowing is correct for TS.
  if ("type" in event && event.type === "overflow") return null;
  const ev = event as CalendarEvent;
  const baseBg = ctx ? ctx.eventColor(ev) : (STATUS_COLOR[ev.status] ?? "var(--muted)");
  const bg = ev.hasConflict ? CONFLICT_COLOR_VAR : baseBg;
  const clientDisplay = ev.clientName || "—";
  // For split overnight halves show the full original session times so the user
  // always sees the real shift boundaries regardless of which half they hover.
  const timeRange = formatTimeRange(ev.sessionStartAt, ev.sessionEndAt, timeMode, ev.workspaceTz);
  const isContinuation = ev.isMorningContinuation === true;
  const isPast = ev.end < new Date();
  const isStatusMuted = ev.status === "cancelled" || ev.status === "completed";
  const showPastVisual = isPast && !isStatusMuted && (ctx?.showPast ?? false);
  const statusLabel = typeof tStatus.has === "function" && !tStatus.has(ev.status) ? ev.status : tStatus(ev.status);
  const labelOverride = ev.kind === "inquiry" ? tInq("inquiry") : undefined;
  const candleAriaLabel = `${ev.title} · ${labelOverride ?? statusLabel}${ev.hasConflict ? " · conflict" : ""}`;

  return (
    <div
      title={`${ev.title} · ${clientDisplay} · ${timeRange}`}
      aria-label={candleAriaLabel}
      className={`relative flex h-full w-full flex-col justify-start gap-0.5 overflow-hidden ps-2.5 pe-2 py-1.5 text-start text-white ${
        isStatusMuted
          ? "line-through opacity-80"
          : showPastVisual
          ? "opacity-60"
          : ""
      }`}
      style={{
        backgroundColor: bg,
        // Morning continuation: omit top border radius cue by reducing top
        // opacity on the stripe so it visually "continues" from the evening half.
        opacity: isContinuation ? 0.85 : showPastVisual ? 0.6 : 1,
      }}
    >
      <span
        className="absolute inset-y-0 start-0 w-1"
        aria-hidden
        style={{ background: stripeBg(bg) }}
      />
      {isContinuation ? (
        <span className="truncate text-[10px] leading-tight opacity-70 italic">
          ↑ {ev.title}
        </span>
      ) : (
        <>
          <span
            className={`truncate text-sm font-semibold leading-tight${showPastVisual ? " line-through" : ""}`}
          >
            {ev.title}
          </span>
          <span className="truncate text-[10px] leading-tight opacity-85">{clientDisplay}</span>
          <span className="whitespace-nowrap text-[10px] leading-tight opacity-85">{timeRange}</span>
        </>
      )}
      {showPastVisual && !isContinuation && <PastPill label={t("past")} />}
      {!isContinuation && (
        <StatusPill
          status={ev.status}
          label={statusLabel}
          labelOverride={labelOverride}
        />
      )}
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
  showPast: boolean;
  eventColor: (ev: { status: BookingStatus; teamId: string | null; colorOverride?: string }) => string;
  toolbarTrailing?: ReactNode;
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
  const timeMode = useTimeFormat();
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
      {/* Left cluster: nav + optional trailing controls (legend chips, team filter) */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Nav pill: outer rounded container owns the single border; divide-x provides per-button dividers */}
        <div className="flex rounded-lg overflow-hidden border border-border bg-background divide-x divide-border">
          <Button
            variant="ghost"
            size="icon-sm"
            className="min-h-11 rounded-none"
            onClick={() => onNavigate("PREV")}
            aria-label={messages.previous}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 rounded-none"
            onClick={() => onNavigate("TODAY")}
          >
            {messages.today}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="min-h-11 rounded-none"
            onClick={() => onNavigate("NEXT")}
            aria-label={messages.next}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
        {ctx?.toolbarTrailing}
      </div>

      {/* Right cluster: date label + jump-to + view switcher */}
      <div className="flex items-center gap-2">
        <span className="hidden lg:block font-semibold text-sm me-1">{label}</span>
        {/* Jump-to popover */}
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="sm"
                className="min-h-11 gap-1.5"
                aria-label={messages.goTo}
              />
            }
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span className="hidden sm:inline">{messages.goTo}</span>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-64 p-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {messages.goTo}
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
                    lang={TIME_INPUT_LANG[timeMode]}
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

        {/* View switcher — pill matching table/calendar toggle; w-auto to stay inline in toolbar */}
        <SegmentedToggle
          value={view}
          onChange={onView}
          ariaLabel={messages.month}
          options={([Views.MONTH, Views.WEEK, Views.DAY] as View[]).map((v) => ({
            key: v,
            label: viewLabel[v] ?? v,
          }))}
          className="w-auto"
        />
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
 * Overnight / multi-day events (end is on a later calendar day than start)
 * render as a wide bar across all occupied cells in rbc. Any own events that
 * START on a bleed-in day would visually stack below that bar without being
 * collapsed into the "+N more" pill. This function detects bleed-in days and
 * suppresses own-start events on those days into an overflow placeholder so
 * the pill appears instead.
 *
 * Only applied in month view — week/day views have time-slot rows and can
 * display overlapping events without a cell-height cap.
 */
export function groupEventsForMonth(
  events: CalendarEvent[],
  workspaceTimezone?: string
): AnyCalendarEvent[] {
  // Local helpers — not exported so they stay scoped to this function.
  function startOfMonthDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
  }
  function dayKey(d: Date): string {
    return format(d, "yyyy-MM-dd");
  }
  // Same "grid display" Date used by gridStartAccessor/gridEndAccessor: its
  // native LOCAL getters encode the event's workspace wall clock rather than
  // the viewer's browser-local timezone, so day-bucketing agrees with the
  // day/week grid regardless of the viewer's own timezone.
  function gridDate(ev: CalendarEvent, which: "start" | "end"): Date {
    const tz = ev.workspaceTz ?? workspaceTimezone ?? FALLBACK_TZ;
    return toCalendarGridDate(which === "start" ? ev.start : ev.end, tz);
  }

  // Pass 1 — identify days that have an inbound overnight/multi-day bleed-over.
  // For every event that crosses a day boundary, every calendar day strictly
  // after the event's start-day (up to and including the event's end-day)
  // receives a bleed-in marker.
  const bleedInDays = new Set<string>();
  for (const ev of events) {
    const startDay = startOfMonthDay(gridDate(ev, "start"));
    const endDay = startOfMonthDay(gridDate(ev, "end"));
    if (endDay > startDay) {
      // Walk each day strictly after startDay through endDay.
      const cursor = new Date(startDay);
      cursor.setDate(cursor.getDate() + 1);
      while (cursor <= endDay) {
        bleedInDays.add(dayKey(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  // Pass 2 — bucket events by their start-day (same as before).
  const byDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = dayKey(gridDate(ev, "start"));
    const bucket = byDay.get(key);
    if (bucket) {
      bucket.push(ev);
    } else {
      byDay.set(key, [ev]);
    }
  }

  // Pass 3 — emit result events, collapsing bleed-in days into overflow pills.
  const result: AnyCalendarEvent[] = [];
  for (const [key, bucket] of byDay) {
    if (bleedInDays.has(key) && bucket.length >= 1) {
      // The wide bar from the overnight event already occupies this cell.
      // Collapse every own event that starts here into a single overflow pill
      // so they don't render as extra stacked bars below the wide bar.
      const first = bucket[0];
      const overflow: OverflowEvent = {
        type: "overflow",
        id: `overflow_${key}`,
        start: first.start,
        end: first.end,
        overflowCount: bucket.length,
        overflowEvents: bucket,
      };
      result.push(overflow);
    } else {
      // Normal day (no inbound bleed): show first event + optional overflow.
      result.push(bucket[0]);
      if (bucket.length > 1) {
        const first = bucket[0];
        const overflow: OverflowEvent = {
          type: "overflow",
          id: `overflow_${key}`,
          start: first.start,
          end: first.end,
          overflowCount: bucket.length - 1,
          overflowEvents: bucket.slice(1),
        };
        result.push(overflow);
      }
    }
  }
  return result;
}

export function BookingCalendar({
  events,
  defaultDate,
  defaultView = Views.MONTH,
  view: viewProp,
  onViewChange,
  date: dateProp,
  onDateChange,
  onSelectEvent,
  onSelectSlot,
  onEventDrop,
  onEventResize,
  onExternalDragStart,
  onExternalDragEnd,
  onDropFromOutside,
  dragFromOutsideItem,
  messages,
  showPast = false,
  pendingIds,
  colorMode = "status",
  teamColorMap,
  toolbarTrailing,
  draggableAccessor,
  workspaceTimezone,
}: Props) {
  const isRtl = useIsRtl();
  function eventColor(ev: { status: BookingStatus; teamId: string | null; colorOverride?: string }): string {
    if (ev.colorOverride) return ev.colorOverride;
    if (colorMode === "team") {
      return (ev.teamId && teamColorMap?.[ev.teamId]) || INACTIVE_TEAM_COLOR;
    }
    return STATUS_COLOR[ev.status] ?? "var(--muted)";
  }
  // Uncontrolled fallback when the parent doesn't pass `view` / `date` props.
  // When controlled, these `useState` calls become inert (we read viewProp/dateProp instead).
  const [internalView, setInternalView] = useState<View>(viewProp ?? defaultView);
  const [internalDate, setInternalDate] = useState<Date>(dateProp ?? defaultDate ?? new Date());
  const view = viewProp ?? internalView;
  const date = dateProp ?? internalDate;
  const setView = useCallback(
    (v: View) => {
      if (onViewChange) onViewChange(v);
      else setInternalView(v);
    },
    [onViewChange]
  );
  const setDate = useCallback(
    (d: Date) => {
      if (onDateChange) onDateChange(d);
      else setInternalDate(d);
    },
    [onDateChange]
  );

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
  const handleViewChange = useCallback(
    (newView: View) => {
      setView(newView);
      if (newView === Views.WEEK || newView === Views.DAY) {
        setDate(new Date());
      }
    },
    [setView, setDate]
  );

  const toolbarCtx = useMemo<CalendarToolbarCtxValue>(
    () => ({
      messages,
      onScrollToHour,
      showPast,
      eventColor,
      toolbarTrailing,
    }),
    // eventColor is recreated only when colorMode/teamColorMap change (inline fn inside render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [messages, onScrollToHour, showPast, colorMode, teamColorMap, toolbarTrailing]
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

  // Pre-process events depending on view:
  // - month: cap each day at 1 pill + overflow placeholder.
  // - week/day: pass events directly (overnight sessions are represented as-is).
  const displayEvents = useMemo<AnyCalendarEvent[]>(() => {
    if (view === Views.MONTH) return groupEventsForMonth(events, workspaceTimezone);
    return events;
  }, [view, events, workspaceTimezone]);

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

  const gridStartAccessor = useCallback(
    (event: AnyCalendarEvent): Date => {
      const ev = event as CalendarEvent;
      const tz = ev.workspaceTz ?? workspaceTimezone ?? FALLBACK_TZ;
      return toCalendarGridDate(event.start, tz);
    },
    [workspaceTimezone]
  );
  const gridEndAccessor = useCallback(
    (event: AnyCalendarEvent): Date => {
      const ev = event as CalendarEvent;
      const tz = ev.workspaceTz ?? workspaceTimezone ?? FALLBACK_TZ;
      return toCalendarGridDate(event.end, tz);
    },
    [workspaceTimezone]
  );

  // react-big-calendar's drag/resize addon computes the dropped position by
  // reading the SAME accessors used for rendering, then doing ms-based delta
  // math on top — so the start/end it hands back to onEventDrop/onEventResize
  // live in the same "grid display" domain as gridStartAccessor/gridEndAccessor.
  // Convert back to true UTC here before forwarding to the caller, so
  // calendar-view.tsx's reschedule logic keeps receiving real UTC instants —
  // event.start/event.end on the event objects themselves are untouched.
  const handleGridEventDrop = useCallback(
    (args: EventInteractionArgs<AnyCalendarEvent>) => {
      if (!onEventDrop) return;
      const ev = args.event as CalendarEvent;
      const tz = ev.workspaceTz ?? workspaceTimezone ?? FALLBACK_TZ;
      onEventDrop({
        ...args,
        start: fromCalendarGridDate(new Date(args.start), tz),
        end: fromCalendarGridDate(new Date(args.end), tz),
      });
    },
    [onEventDrop, workspaceTimezone]
  );
  const handleGridEventResize = useCallback(
    (args: EventInteractionArgs<AnyCalendarEvent>) => {
      if (!onEventResize) return;
      const ev = args.event as CalendarEvent;
      const tz = ev.workspaceTz ?? workspaceTimezone ?? FALLBACK_TZ;
      onEventResize({
        ...args,
        start: fromCalendarGridDate(new Date(args.start), tz),
        end: fromCalendarGridDate(new Date(args.end), tz),
      });
    },
    [onEventResize, workspaceTimezone]
  );
  // The externally-dragged event (from the overflow popover) isn't available
  // here — all candles in one workspace share the same workspace timezone, so
  // the calendar-level fallback is accurate.
  const handleGridDropFromOutside = useCallback(
    (args: DragFromOutsideItemArgs) => {
      if (!onDropFromOutside) return;
      const tz = workspaceTimezone ?? FALLBACK_TZ;
      onDropFromOutside({
        ...args,
        start: fromCalendarGridDate(new Date(args.start), tz),
        end: fromCalendarGridDate(new Date(args.end), tz),
      });
    },
    [onDropFromOutside, workspaceTimezone]
  );

  return (
    <CalendarToolbarCtx.Provider value={toolbarCtx}>
      <div ref={containerRef} className="h-[calc(100vh-14rem)] min-h-112 w-full">
        <DnDCalendar
          rtl={isRtl}
          localizer={localizer}
          events={displayEvents}
          startAccessor={gridStartAccessor}
          endAccessor={gridEndAccessor}
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
          onEventDrop={handleGridEventDrop}
          onEventResize={handleGridEventResize}
          onDropFromOutside={handleGridDropFromOutside}
          dragFromOutsideItem={
            (dragFromOutsideItem ?? undefined) as (() => AnyCalendarEvent) | undefined
          }
          draggableAccessor={draggableAccessor as ((event: object) => boolean) | undefined}
          eventPropGetter={(event) => {
            if ("type" in event && (event as OverflowEvent).type === "overflow") {
              return { className: "cursor-pointer overflow-event", style: { padding: 0, background: "transparent", border: "none" } };
            }
            const calEvent = event as CalendarEvent;
            const bg = eventColor(calEvent);
            const isPending = pendingIds?.has(calEvent.bookingId) ?? false;
            return {
              className: isPending
                ? "opacity-60 pointer-events-none"
                : "cursor-pointer",
              style: { borderColor: bg, padding: 0 },
            };
          }}
        />
      </div>
    </CalendarToolbarCtx.Provider>
  );
}
