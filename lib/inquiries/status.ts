export const INQUIRY_STATUS_VALUES = ["new", "contacted", "booked", "archived"] as const;

export const LEGACY_BOOKED_INQUIRY_STATUS = "converted";
export const BOOKED_INQUIRY_STATUS = "booked";

export function isBookedInquiryStatus(status: string | null | undefined): boolean {
  return status === BOOKED_INQUIRY_STATUS || status === LEGACY_BOOKED_INQUIRY_STATUS;
}

export function getInquiryStatusFilter(status: string): string | { $in: string[] } {
  if (status === BOOKED_INQUIRY_STATUS) {
    return { $in: [BOOKED_INQUIRY_STATUS, LEGACY_BOOKED_INQUIRY_STATUS] };
  }
  return status;
}

export function getInquiryStatusLabelKey(status: string | null | undefined): string {
  return isBookedInquiryStatus(status) ? BOOKED_INQUIRY_STATUS : (status ?? "new");
}
