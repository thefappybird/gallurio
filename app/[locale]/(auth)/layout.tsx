import Image from "next/image";
import Link from "next/link";
import { AmbientBackground } from "@/components/app/ambient-background";
import { AuthBrandPane } from "./_components/auth-brand-pane";

// "Studio Split" auth shell: a brand pane (tagline + trust strip matching the
// landing page, start side in ltr / end side in rtl -- flex-row already
// follows inline direction, no extra rtl classes needed) and a form pane,
// divided by a hairline border (never a shadow). On mobile the brand pane
// collapses to a slim top band (logo only; the tagline/trust list are md+
// only) instead of disappearing.
//
// Height-match fix: the outer split is a flex container with NO items-center
// (default align-items is `stretch`), so both panes always match height to
// whichever is taller -- unlike the throwaway mockup, which centered items
// and let the shorter pane's content leave a gap under the taller one. On
// mobile the panes stack (flex-col) and stretch to the column's own width
// instead, which is exactly the single-column flow we want there.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col bg-onboarding-bg md:flex-row">
      <AmbientBackground />

      {/* Brand pane has no background of its own -- the shared
          AmbientBackground above shows straight through it (the "white"
          pane with the flowing line art), matching the landing hero. */}
      <div className="relative flex shrink-0 flex-col gap-6 overflow-hidden border-b border-border px-4 py-4 text-foreground md:w-[42%] md:min-w-[22rem] md:border-b-0 md:border-e md:px-12 md:py-14">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <Image src="/brand/gallurio-sq.svg" alt="" width={28} height={28} className="h-7 w-7" priority />
          <span className="font-heading text-base font-semibold tracking-tight">Gallurio</span>
        </Link>
        <AuthBrandPane />
      </div>

      {/* Form pane. items-start on mobile: the pane fills remaining viewport
          height (flex-1 in the stacked column), so items-center there would
          vertically center the card in that tall area and leave a large gap
          above it. Centering only makes sense once the split is side-by-side.
          Stays transparent so AmbientBackground shows through the pane's own
          margins -- each form supplies its own solid-background card. */}
      <div className="relative flex flex-1 items-start justify-center px-4 py-10 md:items-center md:py-16">
        {children}
      </div>
    </div>
  );
}
