"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { BookingsToolbar } from "./bookings-toolbar";
import { BookingWizardModal } from "./booking-wizard-modal";
import { useBookingsToolbarPending } from "./bookings-pending-shell";
import type { SupportedCurrency } from "@/lib/validators/workspace";
import type { BookingTeamOption } from "../_data/team-options";
import type { InvoiceThemePresetId, InvoiceThemePreviewBusiness } from "@/lib/invoices/theme";

type ClientHit = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Props = {
  defaultCurrency: SupportedCurrency;
  locale: string;
  workspaceTimezone?: string;
  clients: ClientHit[];
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
  /** Workspace's current invoice PDF theme — seeds the Invoice theme dialog. */
  initialInvoiceTheme?: { preset: InvoiceThemePresetId | "custom"; main: string; accent: string };
  invoiceThemeBusiness?: InvoiceThemePreviewBusiness;
};

/**
 * Client-side wrapper for the table view's "New Booking" button and wizard
 * modal. Manages open state locally so the button always opens the modal even
 * when ?add=1 is already in the URL (prevents no-op URL push on re-click).
 *
 * On open: sets ?add=1 as a side effect for shareability.
 * On close: removes add/date/time/edit params via router.replace.
 */
export function TableBookingManager({
  defaultCurrency,
  locale,
  workspaceTimezone,
  clients,
  canCreate,
  defaultTeamId,
  teams,
  selectedTeams,
  isOwner,
  writableTeams,
  initialInvoiceTheme,
  invoiceThemeBusiness,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const onPendingChange = useBookingsToolbarPending();

  // Stable ref so callbacks that read searchParams don't capture stale closures
  // and don't need searchParams in their dep arrays (which would change identity
  // every render and cause loops in any effect that depends on those callbacks).
  const searchParamsRef = useRef(searchParams);
  // eslint-disable-next-line react-hooks/refs -- intentional: mutable ref updated during render to always hold the latest value; only read in effects/callbacks, never during render itself
  searchParamsRef.current = searchParams;

  // Local open state that decouples "modal is open" from URL presence.
  // Lazy initializer seeds from ?add=1 so a refresh / shared link re-opens the wizard.
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");
  // Nonce key forces modal to remount (resetting form) on each new "add" click.
  const nonceRef = useRef(0);
  const [nonce, setNonce] = useState(0);

  // Sync modal open state with URL changes (browser back/forward, external navigation).
  // The lazy initializer handles the first render; this effect catches subsequent
  // URL changes so the modal closes when ?add=1 is removed from the URL.
  // Guard with equality so React bails out when the boolean hasn't changed,
  // preventing a render cycle when the searchParams object is replaced in place.
  useEffect(() => {
    const next = searchParams.get("add") === "1";
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: mirrors URL ?add=1 into modal open state (external → React sync for browser back/forward support)
    setAddOpen((prev) => (prev === next ? prev : next));
  }, [searchParams]);

  const clearParams = useCallback(
    (params: string[]) => {
      const sp = new URLSearchParams(searchParamsRef.current.toString());
      for (const p of params) sp.delete(p);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname]
  );

  const handleAddClick = useCallback(() => {
    if (!canCreate) return;
    // Bump nonce so the modal remounts fresh even if it was already open.
    nonceRef.current += 1;
    setNonce(nonceRef.current);
    setAddOpen(true);
    // Side-effect: set ?add=1 for shareability / browser refresh.
    const sp = new URLSearchParams(searchParamsRef.current.toString());
    sp.set("add", "1");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [canCreate, router, pathname]);

  const handleClose = useCallback(() => {
    setAddOpen(false);
    clearParams(["add", "date", "time", "edit", "detail"]);
  }, [clearParams]);

  return (
    <>
      <BookingsToolbar
        defaultCurrency={defaultCurrency}
        workspaceTimezone={workspaceTimezone}
        onAddClick={handleAddClick}
        canCreate={canCreate}
        teams={teams}
        selectedTeams={selectedTeams}
        isOwner={isOwner}
        initialInvoiceTheme={initialInvoiceTheme}
        invoiceThemeBusiness={invoiceThemeBusiness}
        onPendingChange={onPendingChange}
      />
      {addOpen ? (
        <BookingWizardModal
          key={nonce}
          mode="create"
          defaultCurrency={defaultCurrency}
          locale={locale}
          workspaceTimezone={workspaceTimezone}
          clients={clients}
          teamId={defaultTeamId ?? undefined}
          teams={writableTeams}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
