import { InquiriesHeaderSkeleton } from "./_components/inquiries-page-skeleton";

// Static on purpose: Next prefetches loading.tsx, so it must not read cookies.
// The view-specific skeleton is the Suspense fallback in page.tsx.
export default function InquiriesLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true">
      <InquiriesHeaderSkeleton />
    </div>
  );
}
