"use client";

import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import { ViewToggle, type BookingsView } from "./view-toggle";

const BookingsToolbarPendingContext = createContext<((pending: boolean) => void) | null>(null);
const BookingsWindowPendingContext = createContext<((pending: boolean) => void) | null>(null);

type Props = {
  title: ReactNode;
  view: BookingsView;
  children: ReactNode;
};

export function useBookingsToolbarPending() {
  const context = useContext(BookingsToolbarPendingContext);
  if (context === null) {
    throw new Error("useBookingsToolbarPending must be used within BookingsPendingShell");
  }
  return context;
}

/** Setter for the calendar's "window refetch in flight" flag (separate from the
 *  toolbar's so the two sources never clobber each other). */
export function useBookingsWindowPending() {
  const context = useContext(BookingsWindowPendingContext);
  if (context === null) {
    throw new Error("useBookingsWindowPending must be used within BookingsPendingShell");
  }
  return context;
}

/**
 * Client shell owning the pending state for the view-toggle (table/calendar
 * switch) and whichever manager's toolbar is currently active (filter
 * changes). While either is pending, the content below is dimmed so a view
 * switch or filter change doesn't look like a no-op while the server subtree
 * re-renders.
 */
export function BookingsPendingShell({ title, view, children }: Props) {
  const [viewPending, setViewPending] = useState(false);
  const [toolbarPending, setToolbarPending] = useState(false);
  const [windowPending, setWindowPending] = useState(false);
  const pending = viewPending || toolbarPending || windowPending;

  return (
    <>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {title}
        <ViewToggle view={view} onPendingChange={setViewPending} />
      </div>

      <div
        aria-busy={pending}
        className={pending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}
      >
        <BookingsToolbarPendingContext.Provider value={setToolbarPending}>
          <BookingsWindowPendingContext.Provider value={setWindowPending}>
            {children}
          </BookingsWindowPendingContext.Provider>
        </BookingsToolbarPendingContext.Provider>
      </div>
    </>
  );
}
