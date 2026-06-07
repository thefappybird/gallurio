export function buildInquiryModalPath(inquiryId: string): string {
  const params = new URLSearchParams({ inquiryId });
  return `/inquiries?${params.toString()}`;
}

export function buildInquiryAuthPath(appBaseUrl: string, inquiryId: string): string {
  const base = appBaseUrl.replace(/\/$/, "");
  const redirectTarget = encodeURIComponent(buildInquiryModalPath(inquiryId));
  return `${base}/sign-in?redirect_url=${redirectTarget}`;
}
