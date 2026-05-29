"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { BookingsToolbar } from "./bookings-toolbar";
import { CalendarView, type ClientHit } from "./calendar-view";
import type { CalendarEvent } from "./booking-calendar";
import type { SupportedCurrency } from "@/lib/validators/workspace";

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  defaultCurrency: SupportedCurrency;
  locale: string;
  workspaceTimezone?: string;
  initialClients?: ClientHit[];
  messages: React.ComponentProps<typeof CalendarView>["messages"];
};

/**
 * Client-side wrapper that unifies BookingsToolbar + CalendarView for the
 * calendar view. Owns the "New Booking" open signal so the button always fires
 * even when ?add=1 is already in the URL — the URL is updated as a side effect.
 */
export function CalendarBookingManager({
  events,
  defaultDate,
  defaultCurrency,
  locale,
  workspaceTimezone,
  initialClients,
  messages,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Incrementing nonce signals CalendarView to open a fresh add modal.
  const nonceRef = useRef(0);
  const [addNonce, setAddNonce] = useState(0);

  const handleAddClick = useCallback(() => {
    nonceRef.current += 1;
    setAddNonce(nonceRef.current);
    // Side-effect: set ?add=1 for shareability.
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("add", "1");
    sp.delete("date");
    sp.delete("time");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  return (
    <>
      <BookingsToolbar
        defaultCurrency={defaultCurrency}
        onAddClick={handleAddClick}
        view="calendar"
      />
      <CalendarView
        events={events}
        defaultDate={defaultDate}
        defaultCurrency={defaultCurrency}
        locale={locale}
        workspaceTimezone={workspaceTimezone}
        initialClients={initialClients}
        messages={messages}
        externalAddNonce={addNonce}
      />
    </>
  );
}
