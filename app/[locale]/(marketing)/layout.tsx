import type { ReactNode } from "react";
import { MarketingHeader } from "./_components/marketing-header";
import { MarketingFooter } from "./_components/marketing-footer";

// Shared shell for the public marketing surface (landing + compliance pages).
// Header/footer are client components so each can detect the landing route
// and switch to the dark-hero-matching tone — see marketing-header.tsx.
export default function MarketingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <MarketingHeader />
      <main className="flex flex-1 flex-col">{children}</main>
      <MarketingFooter />
    </div>
  );
}
