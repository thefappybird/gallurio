import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Scoped to the `(public)` branch so a `notFound()` call inside
 * `w/[orgSlug]/layout.tsx` (unpublished/missing workspace) resolves here
 * instead of bubbling to the root `app/not-found.tsx` — that file renders its
 * own <html>/<body>, which nests inside this branch's own root layout
 * (`app/(public)/layout.tsx`) and crashes hydration. No next-intl here: the
 * public branch has no NextIntlClientProvider, so this stays plain English.
 */
export default function PublicNotFound() {
  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <span className="font-mono text-8xl font-bold text-muted-foreground/30 select-none">
          404
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold text-foreground">Page not found</h1>
          <p className="text-sm text-muted-foreground">
            This page doesn&apos;t exist or is no longer published.
          </p>
        </div>
        <Link href="/" className={cn(buttonVariants({ variant: "brand", size: "lg" }))}>
          Go to Gallurio
        </Link>
      </div>
    </main>
  );
}
