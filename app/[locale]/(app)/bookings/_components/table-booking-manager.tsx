"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { BookingsToolbar } from "./bookings-toolbar";
import { BookingWizardModal } from "./booking-wizard-modal";
import type { SupportedCurrency } from "@/lib/validators/workspace";

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
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Local open state that decouples "modal is open" from URL presence.
  // Lazy initializer seeds from ?add=1 so a refresh / shared link re-opens the wizard.
  const [addOpen, setAddOpen] = useState(() => searchParams.get("add") === "1");
  // Nonce key forces modal to remount (resetting form) on each new "add" click.
  const nonceRef = useRef(0);
  const [nonce, setNonce] = useState(0);

  const clearParams = useCallback(
    (params: string[]) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const p of params) sp.delete(p);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const handleAddClick = useCallback(() => {
    // Bump nonce so the modal remounts fresh even if it was already open.
    nonceRef.current += 1;
    setNonce(nonceRef.current);
    setAddOpen(true);
    // Side-effect: set ?add=1 for shareability / browser refresh.
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("add", "1");
    const qs = sp.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [router, pathname, searchParams]);

  const handleClose = useCallback(() => {
    setAddOpen(false);
    clearParams(["add", "date", "time"]);
  }, [clearParams]);

  return (
    <>
      <BookingsToolbar
        defaultCurrency={defaultCurrency}
        onAddClick={handleAddClick}
      />
      {addOpen ? (
        <BookingWizardModal
          key={nonce}
          mode="create"
          defaultCurrency={defaultCurrency}
          locale={locale}
          workspaceTimezone={workspaceTimezone}
          clients={clients}
          onClose={handleClose}
        />
      ) : null}
    </>
  );
}
