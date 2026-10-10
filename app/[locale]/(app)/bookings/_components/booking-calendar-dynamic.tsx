"use client";

import dynamic from "next/dynamic";
import {
  BOOKINGS_CALENDAR_FALLBACK,
  CalendarSkeleton,
  INQUIRIES_CALENDAR_FALLBACK,
} from "@/components/app/calendar-skeleton";

/**
 * react-big-calendar + its CSS + the drag-and-drop addon load as one client
 * chunk, on demand (calendar view only). Table views never download them.
 * One instance per page: the loader skeleton is server-rendered, so each
 * needs its own height fallback to avoid a shift at hydration.
 */
const load = () => import("./booking-calendar").then((m) => m.BookingCalendar);

export const BookingCalendarLazy = dynamic(load, {
  ssr: false,
  loading: () => <CalendarSkeleton fallbackClassName={BOOKINGS_CALENDAR_FALLBACK} />,
});

export const InquiriesCalendarLazy = dynamic(load, {
  ssr: false,
  loading: () => <CalendarSkeleton fallbackClassName={INQUIRIES_CALENDAR_FALLBACK} />,
});
