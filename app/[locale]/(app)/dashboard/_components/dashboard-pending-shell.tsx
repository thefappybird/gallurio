"use client";

import { useState, type ReactNode } from "react";
import { DashboardDateFilter } from "./dashboard-date-filter";
import { DashboardTabs } from "./dashboard-tabs";
import type { DashboardTab } from "@/lib/dashboard-preferences";

type Props = {
  greeting: ReactNode;
  today: string;
  currentMonth: string;
  currentYear: number;
  currentWeek: string;
  tab: DashboardTab;
  children: ReactNode;
};

/**
 * Client shell owning the pending state for the date-filter Apply/Clear and
 * the Bookings/Portfolio tab switch (both server-navigation triggers). While
 * either is pending, the widget area below is dimmed so the switch/filter
 * doesn't look like a no-op while the server subtree re-renders.
 */
export function DashboardPendingShell({
  greeting,
  today,
  currentMonth,
  currentYear,
  currentWeek,
  tab,
  children,
}: Props) {
  const [datePending, setDatePending] = useState(false);
  const [tabPending, setTabPending] = useState(false);
  const pending = datePending || tabPending;

  return (
    <>
      {/* Title+date own one row and the filter/tab controls own the next until
          lg. Sharing a row from sm up left the greeting wrapping to three
          lines and pushed the tab strip off the right edge at 768, where the
          docked sidebar takes its share of the width. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        {greeting}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <DashboardDateFilter
            today={today}
            currentMonth={currentMonth}
            currentYear={currentYear}
            currentWeek={currentWeek}
            onPendingChange={setDatePending}
          />
          <DashboardTabs tab={tab} onPendingChange={setTabPending} />
        </div>
      </div>

      <div
        aria-busy={pending}
        className={pending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}
      >
        {children}
      </div>
    </>
  );
}
