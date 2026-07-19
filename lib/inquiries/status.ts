export const INQUIRY_STATUS_VALUES = ["inquiry", "booked", "converted", "archived"] as const;

export const BOOKED_INQUIRY_STATUS = "booked";
// "converted" is a terminal booked state treated identically to "booked" for
// tab counts, idempotency guards, and the isBooked helper.
export const CONVERTED_INQUIRY_STATUS = "converted";

export function isBookedInquiryStatus(status: string | null | undefined): boolean {
  return status === BOOKED_INQUIRY_STATUS || status === CONVERTED_INQUIRY_STATUS;
}

export function getInquiryStatusFilter(status: string): string | { $in: string[] } {
  if (status === BOOKED_INQUIRY_STATUS) {
    return { $in: [BOOKED_INQUIRY_STATUS, CONVERTED_INQUIRY_STATUS] };
  }
  return status;
}

export function getInquiryStatusLabelKey(status: string | null | undefined): string {
  // "converted" has its own label key (displayed as "Converted To Booking").
  if (status === CONVERTED_INQUIRY_STATUS) return CONVERTED_INQUIRY_STATUS;
  if (isBookedInquiryStatus(status)) return BOOKED_INQUIRY_STATUS;
  // Legacy "approved" was an intermediate value (contacted -> approved -> booked).
  // Map it to "booked" so it renders correctly without a MISSING_MESSAGE error.
  if (status === "approved") return BOOKED_INQUIRY_STATUS;
  // Safe fallback: if the status is unknown or missing, return "inquiry" so t(key)
  // never hits MISSING_MESSAGE. This is defence-in-depth only -- callers should
  // pass a valid INQUIRY_STATUS_VALUES member.
  const key = status ?? "inquiry";
  return (INQUIRY_STATUS_VALUES as readonly string[]).includes(key) ? key : "inquiry";
}
