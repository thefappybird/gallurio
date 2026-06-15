export const INQUIRY_STATUS_VALUES = ["new", "booked", "converted", "archived"] as const;

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
  return status ?? "new";
}
