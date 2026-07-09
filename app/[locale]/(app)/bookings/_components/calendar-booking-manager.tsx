"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { BookingsToolbar } from "./bookings-toolbar";
import { CalendarView, type ClientHit } from "./calendar-view";
import type { CalendarEvent } from "./booking-calendar";
import type { SupportedCurrency } from "@/lib/validators/workspace";
import type { BookingTeamOption } from "../_data/team-options";
import type { InvoiceThemePresetId } from "@/lib/invoices/theme";

type Props = {
  events: CalendarEvent[];
  defaultDate?: Date;
  defaultCurrency: SupportedCurrency;
  locale: string;
  workspaceTimezone?: string;
  initialClients?: ClientHit[];
  messages: React.ComponentProps<typeof CalendarView>["messages"];
  /** Whether the current user may create bookings (owner-only in Phase 4). */
  canCreate: boolean;
  /** The Main team id to attach new bookings to (null when canCreate is false). */
  defaultTeamId: string | null;
  /** All teams visible to the current user (for the team picker filter). */
  teams: BookingTeamOption[];
  /** Currently active team filter value — "all" or a team id. */
  selectedTeams: string[];
  /** Whether the current user is a workspace owner. */
  isOwner: boolean;
  /** Teams the current user may assign to new bookings (writable teams). */
  writableTeams: BookingTeamOption[];
  /** Controls how calendar candles are colored — by team or by booking status. */
  colorMode: "team" | "status";
  /** Map of team id → hex color for candle coloring. */
  teamColorMap: Record<string, string>;
  /** Workspace's current invoice PDF theme — seeds the Invoice theme dialog. */
  initialInvoiceTheme?: { preset: InvoiceThemePresetId | "custom"; main: string; accent: string };
  /** Bubbles the toolbar's own pending state up to a wrapping shell. */
  onPendingChange?: (pending: boolean) => void;
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
  canCreate,
  defaultTeamId,
  teams,
  selectedTeams,
  isOwner,
  writableTeams,
  colorMode,
  teamColorMap,
  initialInvoiceTheme,
  onPendingChange,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Incrementing nonce signals CalendarView to open a fresh add modal.
  const nonceRef = useRef(0);
  const [addNonce, setAddNonce] = useState(0);

  const handleAddClick = useCallback(() => {
    if (!canCreate) return;
    nonceRef.current += 1;
    setAddNonce(nonceRef.current);
    // Side-effect: set ?add=1 for shareability.
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("add", "1");
    sp.delete("date");
    sp.delete("time");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [canCreate, router, pathname, searchParams]);

  return (
    <>
      <BookingsToolbar
        defaultCurrency={defaultCurrency}
        onAddClick={handleAddClick}
        view="calendar"
        canCreate={canCreate}
        teams={teams}
        selectedTeams={selectedTeams}
        isOwner={isOwner}
        initialInvoiceTheme={initialInvoiceTheme}
        onPendingChange={onPendingChange}
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
        canCreate={canCreate}
        defaultTeamId={defaultTeamId}
        writableTeams={writableTeams}
        colorMode={colorMode}
        teamColorMap={teamColorMap}
        teams={teams}
        selectedTeams={selectedTeams}
        isOwner={isOwner}
      />
    </>
  );
}
