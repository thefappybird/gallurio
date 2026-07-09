"use client";

import { useState, type ReactNode } from "react";
import { ViewToggle, type BookingsView } from "./view-toggle";

type Props = {
  title: ReactNode;
  view: BookingsView;
  /** Render-prop so the caller can wire the exposed toolbar-pending setter
   * into whichever manager (table/calendar) it renders for the active view. */
  children: (onToolbarPendingChange: (pending: boolean) => void) => ReactNode;
};

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
  const pending = viewPending || toolbarPending;

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
        {children(setToolbarPending)}
      </div>
    </>
  );
}
