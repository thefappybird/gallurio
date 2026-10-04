"use client";

import dynamic from "next/dynamic";
import { CalendarSkeleton } from "@/components/app/calendar-skeleton";

/**
 * react-big-calendar + its CSS + the drag-and-drop addon load as one client
 * chunk, on demand (calendar view only). Table views never download them.
 */
export const BookingCalendarLazy = dynamic(
  () => import("./booking-calendar").then((m) => m.BookingCalendar),
  { ssr: false, loading: () => <CalendarSkeleton /> }
);
