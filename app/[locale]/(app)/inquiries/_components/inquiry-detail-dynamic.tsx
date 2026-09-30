"use client";

import dynamic from "next/dynamic";

/**
 * The inquiry detail modal pulls in the client/event/booking-draft cards and
 * their actions, so it loads as its own chunk on first open. Mount it only while
 * open; warm it from a row's pointer-enter / focus.
 */
export const InquiryDetailModalLazy = dynamic(
  () => import("./inquiry-detail-modal").then((m) => m.InquiryDetailModal),
  { ssr: false }
);

export function preloadInquiryDetailModal(): void {
  void import("./inquiry-detail-modal").catch(() => {});
}
