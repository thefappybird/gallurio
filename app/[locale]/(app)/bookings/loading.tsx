import { BookingsHeaderSkeleton } from "./_components/bookings-page-skeleton";

// Static on purpose: Next prefetches loading.tsx, so it must not read cookies
// (which would make it dynamic). The view-specific skeleton (table vs
// calendar) is the Suspense fallback in page.tsx once the view is known.
export default function BookingsLoading() {
  return (
    <div className="flex min-w-0 flex-col gap-4" aria-busy="true">
      <BookingsHeaderSkeleton />
    </div>
  );
}
