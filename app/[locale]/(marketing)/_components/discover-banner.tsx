"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightIcon, PauseIcon, PlayIcon } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { buttonVariants } from "@/components/ui/button";
import type { DiscoverCard } from "@/lib/db/queries/discover";
import { collectGoogleFontFamilies } from "@/lib/page-builder/fonts";
import { GoogleFontLinks } from "@/lib/page-builder/GoogleFontLinks";
import { DiscoverTile } from "../discover/_components/discover-tile";

const MIN_ITEMS = 8;

// Three angled rows: [start offset into the list, seconds per loop, reversed].
const ROWS = [
  { offset: 0, duration: 95, reverse: false },
  { offset: 5, duration: 78, reverse: true },
  { offset: 9, duration: 110, reverse: false },
] as const;

function rotate<T>(list: T[], by: number): T[] {
  const n = by % list.length;
  return list.slice(n).concat(list.slice(0, n));
}

/** Tile box ratio: the cover's own shape (kept sane for extreme crops), 4:5 for typographic brand tiles. */
function tileRatio(card: DiscoverCard): number {
  if (!card.cover || !(card.cover.width > 0) || !(card.cover.height > 0)) return 0.8;
  return Math.min(2.5, Math.max(0.5, card.cover.width / card.cover.height));
}

/** The list is doubled inside each set so ONE set always outspans the visible row (seamless -50% loop). */
function StripSet({ cards }: { cards: DiscoverCard[] }) {
  return (
    <div className="dsc-set">
      {[...cards, ...cards].map((card, i) => (
        <div key={`${card.slug}-${i}`} className="dsc-st" style={{ "--ar": tileRatio(card) } as React.CSSProperties}>
          <DiscoverTile card={card} decorative />
        </div>
      ))}
    </div>
  );
}

export function DiscoverBanner() {
  const t = useTranslations("marketing.discover.banner");
  const [items, setItems] = useState<DiscoverCard[] | null>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/public/discover?limit=14", { cache: "no-store", signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((page: { items?: DiscoverCard[] }) => {
        if (Array.isArray(page.items)) setItems(page.items);
      })
      .catch(() => {
        // Decorative section: stay hidden on any failure.
      });
    return () => controller.abort();
  }, []);

  if (!items || items.length < MIN_ITEMS) return null;

  return (
    <section aria-labelledby="discover-banner-title" className="border-t border-border px-4 py-12 sm:px-6 sm:py-16">
      {/* Brand tiles may use a Google heading font (runtime data, so a <link>, not next/font). */}
      <GoogleFontLinks families={collectGoogleFontFamilies(items.map((card) => card.brand.headingFont))} />
      <div
        data-paused={paused ? "" : undefined}
        className="dsc-banner relative mx-auto grid max-w-6xl overflow-hidden rounded-[var(--radius-surface)] bg-foreground text-background ring-1 ring-inset ring-background/15 min-[821px]:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
      >
        <div className="relative z-10 max-w-lg self-center p-6 pb-5 text-start min-[821px]:p-12">
          <h2 id="discover-banner-title" className="text-balance font-heading text-2xl font-bold tracking-tight sm:text-3xl">
            {t("title")}
          </h2>
          <p className="mt-3 text-pretty text-base leading-7 text-background/70">{t("body")}</p>
          <Link href="/discover" className={buttonVariants({ variant: "brand", size: "lg", className: "mt-6 px-4" })}>
            {t("cta")}
            <ArrowRightIcon aria-hidden="true" className="rtl:-scale-x-100" />
          </Link>
        </div>
        <div aria-hidden="true" className="dsc-strip">
          <div className="dsc-rot">
            {ROWS.map(({ offset, duration, reverse }) => {
              const cards = rotate(items, offset);
              return (
                <div
                  key={offset}
                  data-discover-row=""
                  aria-hidden="true"
                  dir="ltr"
                  data-reverse={reverse ? "" : undefined}
                  className="dsc-row"
                  style={{ "--dur": `${duration}s` } as React.CSSProperties}
                >
                  <div className="dsc-track">
                    <StripSet cards={cards} />
                    <StripSet cards={cards} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setPaused((value) => !value)}
          aria-label={paused ? t("resume") : t("pause")}
          title={paused ? t("resume") : t("pause")}
          className="absolute bottom-3 end-3 z-20 grid size-9 cursor-pointer place-items-center rounded-[var(--radius)] border border-background/25 bg-foreground text-background outline-none transition-colors hover:bg-background/15 focus-visible:ring-2 focus-visible:ring-brand active:translate-y-px motion-reduce:hidden"
        >
          {paused ? <PlayIcon aria-hidden="true" className="size-4" /> : <PauseIcon aria-hidden="true" className="size-4" />}
        </button>
      </div>
    </section>
  );
}
