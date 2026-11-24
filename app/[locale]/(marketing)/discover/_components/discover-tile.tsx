"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { DiscoverCard } from "@/lib/db/queries/discover";
import { categoryLine } from "@/lib/discover/labels";
import { fontFamilyValue } from "@/lib/page-builder/fonts";
import { cn } from "@/lib/utils";

type Props = {
  card: DiscoverCard;
  onOpen?: (slug: string) => void;
  /** Image only: no link, no overlay, `aria-hidden` (home-page banner). */
  decorative?: boolean;
};

/**
 * Typographic stand-in built from the portfolio's own brand kit (colors + heading
 * font), used when there is no cover or the cover fails to load. Sizes track the
 * tile width through container-query units so it reads at card and thumbnail size.
 */
export function BrandTile({ card, line, dimOnHover = false }: { card: DiscoverCard; line: string; dimOnHover?: boolean }) {
  const { bg, fg, accent, headingFont } = card.brand;
  const initial = Array.from(card.name.trim())[0]?.toUpperCase() ?? "";
  return (
    <span
      data-brand-tile=""
      className={cn(
        "flex aspect-[4/5] w-full flex-col justify-between [container-type:inline-size]",
        dimOnHover &&
          "transition-opacity duration-200 group-hover:opacity-35 group-focus-visible:opacity-35 motion-reduce:transition-none",
      )}
      style={{
        backgroundColor: bg,
        color: fg,
        padding: "9cqw",
        fontFamily: fontFamilyValue(headingFont),
      }}
    >
      <span
        aria-hidden="true"
        className="grid aspect-square place-items-center rounded-full font-semibold leading-none"
        style={{ width: "11cqw", backgroundColor: accent, color: bg, fontSize: "5.4cqw" }}
      >
        {initial}
      </span>
      <span className="block">
        <span aria-hidden="true" className="mb-[3cqw] block" style={{ width: "12cqw", height: "0.8cqw", backgroundColor: accent }} />
        <span
          className="block text-balance leading-[1.04] tracking-tight"
          style={{ fontSize: "clamp(13px, 12.5cqw, 64px)" }}
        >
          {card.name}
        </span>
        {line ? (
          <span
            className="mt-[3cqw] block font-semibold uppercase tracking-wider"
            style={{ color: accent, fontSize: "max(8px, 3.9cqw)" }}
          >
            {line}
          </span>
        ) : null}
      </span>
    </span>
  );
}

export function DiscoverTile({ card, onOpen, decorative = false }: Props) {
  const locale = useLocale();
  const tCategory = useTranslations("publicPage.seoDefaults");
  const [coverFailed, setCoverFailed] = useState(false);
  const line = categoryLine(card, locale, (key) => tCategory(key));
  const label = [card.name, line].filter(Boolean).join(", ");
  const cover = coverFailed ? null : card.cover;

  if (decorative) {
    // Pure imagery (home-page banner): no link, no overlay, nothing for AT to announce.
    return (
      <div aria-hidden="true" className="relative overflow-hidden rounded-[var(--radius-surface)] bg-foreground">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Cloudflare/OG image of arbitrary size
          <img
            src={cover.url}
            alt=""
            width={cover.width}
            height={cover.height}
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="block h-auto w-full"
          />
        ) : (
          <BrandTile card={card} line={line} />
        )}
      </div>
    );
  }

  return (
    <a
      href={`?p=${card.slug}`}
      aria-label={label}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
        event.preventDefault();
        onOpen?.(card.slug);
      }}
      className="group relative block overflow-hidden rounded-[var(--radius-surface)] bg-foreground outline-none after:pointer-events-none after:absolute after:inset-0 after:ring-1 after:ring-inset after:ring-foreground/10 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {cover ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element -- remote Cloudflare/OG image of arbitrary size */}
          <img
            src={cover.url}
            alt=""
            width={cover.width}
            height={cover.height}
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="block h-auto w-full transition-opacity duration-200 group-hover:opacity-35 group-focus-visible:opacity-35 motion-reduce:transition-none"
          />
        </>
      ) : (
        <BrandTile card={card} line={line} dimOnHover />
      )}
      <span
        data-tile-overlay=""
        className="absolute inset-x-0 bottom-0 block p-3 text-start text-background opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none"
      >
        <span className="block text-sm font-semibold leading-snug">{card.name}</span>
        {line ? <span className="block text-xs leading-snug opacity-85">{line}</span> : null}
      </span>
    </a>
  );
}
