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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
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
