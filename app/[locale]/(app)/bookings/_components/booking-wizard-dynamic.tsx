"use client";

import dynamic from "next/dynamic";

/**
 * The booking wizard (react-hook-form, five steps, map picker, client-match
 * dialog) is only needed once a booking is being created/edited, so it loads as
 * its own chunk on demand. Importers mount it only while open.
 */
export const BookingWizardLazy = dynamic(
  () => import("./booking-wizard-modal").then((m) => m.BookingWizardModal),
  { ssr: false }
);

/** Warm the chunk (call from the "New booking" trigger's pointer-enter / focus). */
export function preloadBookingWizard(): void {
  void import("./booking-wizard-modal");
}
