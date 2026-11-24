"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Copy, ExternalLink, Flag, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DiscoverDetail } from "@/lib/db/queries/discover";
import { SUPPORT_EMAIL } from "@/lib/email/brand";
import { categoryLine } from "@/lib/discover/labels";
import { portfolioPublicUrl } from "@/lib/portfolio/publicUrl";
import { SEO_DEFAULT_KEYS } from "@/lib/portfolio/seoDefaults";
import { BrandTile } from "./discover-tile";

type Props = {
  detail: DiscoverDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function Info({ detail }: { detail: DiscoverDetail }) {
  const locale = useLocale();
  const t = useTranslations("marketing.discover.modal");
  const tCategory = useTranslations("publicPage.seoDefaults");
  const [copied, setCopied] = useState(false);

  const line = categoryLine(detail, locale, (key) => tCategory(key));
  const pitch =
    detail.pitch.trim() ||
    (detail.category
      ? tCategory(SEO_DEFAULT_KEYS.homeDescription, {
          name: detail.name,
          businessType: tCategory(SEO_DEFAULT_KEYS.businessType[detail.category]),
        })
      : tCategory(SEO_DEFAULT_KEYS.homeDescriptionGeneric, { name: detail.name }));

  async function copyLink() {
    const url = `${window.location.origin}${window.location.pathname}?p=${detail.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (insecure context / permissions): leave the label unchanged.
    }
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-col border-border min-[721px]:border-s">
      <div className="min-h-0 flex-1 overflow-auto p-5 min-[721px]:p-8 min-[721px]:pb-4">
        <h2 id="discover-dialog-name" className="pe-12 text-balance text-2xl font-bold leading-tight tracking-tight">
          {detail.name}
        </h2>
        {line ? <p className="mt-1.5 text-muted-foreground">{line}</p> : null}
        <p className="mt-5 max-w-[42ch] text-pretty leading-relaxed">{pitch}</p>
      </div>
      <div className="grid gap-3 border-t border-border bg-card px-5 pt-3 pb-4 max-[720px]:sticky max-[720px]:bottom-0 min-[721px]:px-8 min-[721px]:pb-5">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <a
            href={portfolioPublicUrl(detail.slug)}
            target="_blank"
            rel="noopener"
            className={cn(buttonVariants({ variant: "brand" }), "h-10 gap-2 px-4 text-sm font-semibold")}
          >
            {t("visit")}
            <ExternalLink aria-hidden="true" />
          </a>
          <Button type="button" variant="outline" className="h-10 gap-2 px-3 text-sm" onClick={copyLink}>
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
          </Button>
        </div>
        <a
          href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(`Discover report: ${detail.slug}`)}`}
          className="inline-flex items-center gap-1.5 justify-self-start rounded-[var(--radius)] py-1 text-[0.8125rem] text-muted-foreground outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Flag aria-hidden="true" className="size-3.5" />
          {t("report")}
        </a>
      </div>
    </div>
  );
}

type Slide = { url: string; width: number; height: number; alt: string };

function Carousel({ detail, index, onIndex }: { detail: DiscoverDetail; index: number; onIndex: (i: number) => void }) {
  const t = useTranslations("marketing.discover.modal");
  const locale = useLocale();
  const tCategory = useTranslations("publicPage.seoDefaults");
  const slides: Slide[] = detail.images.length ? detail.images : detail.cover ? [{ ...detail.cover, alt: "" }] : [];
  const many = slides.length > 1;
  const current = slides[index];
  const nav =
    "absolute top-1/2 z-[1] grid size-11 -translate-y-1/2 cursor-pointer place-items-center rounded-[var(--radius)] border border-border bg-card outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:bg-muted/70 motion-reduce:transition-none";

  return (
    <div
      role="group"
      aria-roledescription="carousel"
      aria-label={t("photos")}
      className="grid min-h-0 min-w-0 grid-rows-[minmax(0,1fr)_auto] bg-muted max-[720px]:grid-rows-[auto_auto]"
    >
      <div className="relative min-h-0 overflow-hidden max-[720px]:aspect-[4/3]">
        {current ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote Cloudflare image of arbitrary size
          <img
            key={current.url}
            src={current.url}
            alt={current.alt || detail.name}
            className="absolute inset-0 size-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 grid place-items-center">
            <div className="w-1/2">
              <BrandTile card={detail} line={categoryLine(detail, locale, (key) => tCategory(key))} />
            </div>
          </div>
        )}
        {many ? (
          <>
            <button type="button" aria-label={t("previous")} onClick={() => onIndex(index - 1)} className={cn(nav, "start-3")}>
              <ChevronLeft aria-hidden="true" className="size-5 rtl:-scale-x-100" />
            </button>
            <button type="button" aria-label={t("next")} onClick={() => onIndex(index + 1)} className={cn(nav, "end-3")}>
              <ChevronRight aria-hidden="true" className="size-5 rtl:-scale-x-100" />
            </button>
            <span
              aria-live="polite"
              className="absolute start-3 bottom-3 rounded-[var(--radius)] border border-border bg-card px-2 py-0.5 text-xs font-semibold tabular-nums"
            >
              {t("counter", { current: index + 1, total: slides.length })}
            </span>
          </>
        ) : null}
      </div>
      {many ? (
        <div className="flex gap-2 overflow-x-auto border-t border-border bg-card p-2.5">
          {slides.map((slide, i) => (
            <button
              key={slide.url}
              type="button"
              aria-label={t("thumb", { n: i + 1, total: slides.length })}
              aria-current={i === index ? "true" : undefined}
              onClick={() => onIndex(i)}
              className="h-12 w-16 flex-none cursor-pointer overflow-hidden rounded-[var(--radius)] bg-muted p-0 opacity-60 outline-1 -outline-offset-1 outline-foreground/10 transition-opacity hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring aria-[current=true]:opacity-100 aria-[current=true]:outline-2 aria-[current=true]:outline-foreground motion-reduce:transition-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- remote Cloudflare image of arbitrary size */}
              <img src={slide.url} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DiscoverDialog({ detail, open, onOpenChange }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const shown = open && detail !== null;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (shown && !dialog.open) dialog.showModal();
    if (!shown && dialog.open) dialog.close();
  }, [shown]);

  useEffect(() => {
    if (!shown) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [shown]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="discover-dialog-name"
      onClose={() => onOpenChange(false)}
      onClick={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
      className={cn(
        "m-auto h-[min(40rem,calc(100dvh-3rem))] w-[min(66rem,calc(100vw-3rem))] max-h-none max-w-none overflow-hidden rounded-[var(--radius-surface)] border-0 bg-card p-0 text-foreground outline-1 outline-foreground/10",
        "opacity-0 transition-[opacity,translate] duration-300 open:opacity-100 starting:open:opacity-0 motion-reduce:transition-none",
        "translate-y-3 open:translate-y-0 starting:open:translate-y-3 backdrop:bg-foreground/60",
        "max-[720px]:mb-0 max-[720px]:h-auto max-[720px]:max-h-[92dvh] max-[720px]:w-screen",
      )}
    >
      {detail ? <Body key={detail.slug} detail={detail} onClose={() => onOpenChange(false)} /> : null}
    </dialog>
  );
}

function Body({ detail, onClose }: { detail: DiscoverDetail; onClose: () => void }) {
  const t = useTranslations("marketing.discover.modal");
  const [index, setIndex] = useState(0);
  const count = detail.images.length || (detail.cover ? 1 : 0);
  const go = (i: number) => setIndex(((i % count) + count) % count);

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (count < 2 || (event.key !== "ArrowRight" && event.key !== "ArrowLeft")) return;
    event.preventDefault();
    // Arrows follow the reading direction: under RTL, "next" sits on the left.
    const rtl = event.currentTarget.closest("[dir]")?.getAttribute("dir") === "rtl";
    const forward = event.key === "ArrowRight" ? !rtl : rtl;
    go(index + (forward ? 1 : -1));
  }

  return (
    <div
      onKeyDown={onKeyDown}
      className="grid h-full grid-cols-1 min-[721px]:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] max-[720px]:max-h-[92dvh] max-[720px]:overflow-auto"
    >
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className="absolute end-3 top-3 z-10 grid size-10 cursor-pointer place-items-center rounded-[var(--radius)] border border-border bg-card outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
      <Carousel detail={detail} index={index} onIndex={go} />
      <Info detail={detail} />
    </div>
  );
}
