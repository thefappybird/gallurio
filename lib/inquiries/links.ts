export function buildInquiryModalPath(inquiryId: string): string {
  const params = new URLSearchParams({ inquiryId });
  return `/inquiries?${params.toString()}`;
}
