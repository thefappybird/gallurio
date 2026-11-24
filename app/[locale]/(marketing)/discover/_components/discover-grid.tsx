"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";
import { collectGoogleFontFamilies } from "@/lib/page-builder/fonts";
import { GoogleFontLinks } from "@/lib/page-builder/GoogleFontLinks";
import { cn } from "@/lib/utils";
import type { BusinessType, DiscoverCard, DiscoverDetail } from "@/lib/db/queries/discover";
import { DiscoverDialog } from "./discover-dialog";
import { DiscoverTile } from "./discover-tile";

type Props = {
  initialItems: DiscoverCard[];
  initialCursor: string | null;
  initialCategory: BusinessType | null;
  initialQuery: string;
  initialDetail: DiscoverDetail | null;
};

// "other" is a valid business type but never a filter (the API rejects it too).
const CATEGORIES: Exclude<BusinessType, "other">[] = [
  "photographer",
  "venue",
  "planner",
  "stylist",
  "catering",
  "entertainer",
  "artists",
];

const SEARCH_DEBOUNCE_MS = 250;
const SKELETON_RATIOS = ["4/5", "1/1", "3/4", "5/6", "1/1", "4/5", "3/4", "4/3"];

const COLUMNS = "columns-2 gap-4 min-[760px]:columns-3 min-[760px]:gap-5 min-[1100px]:columns-4";
const COLUMN_ITEM = "mb-4 break-inside-avoid min-[760px]:mb-5";

export function DiscoverGrid({ initialItems, initialCursor, initialCategory, initialQuery, initialDetail }: Props) {
  const t = useTranslations("marketing.discover");
  const tCategory = useTranslations("publicPage.seoDefaults");
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [category, setCategory] = useState(initialCategory);
  const [query, setQuery] = useState(initialQuery);

  // Server-rendered page (filters live in the URL); "Load more" appends client-side.
  const [seed, setSeed] = useState(initialItems);
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const generation = useRef(0);
  // A new server result invalidates any in-flight "Load more" (its cursor is stale).
  useEffect(() => {
    generation.current += 1;
  }, [initialItems]);
  if (seed !== initialItems) {
    // A new server result (filter change) replaces whatever was appended.
    setSeed(initialItems);
    setItems(initialItems);
    setCursor(initialCursor);
    setLoadError(false);
    setLoadingMore(false);
  }

  // The modal is client-driven: tiles fetch the detail and mirror `?p=` with the
  // native History API (no server round trip); `initialDetail` covers deep links.
  const [detail, setDetail] = useState(initialDetail);
  const [dialogOpen, setDialogOpen] = useState(initialDetail !== null);
  const [detailError, setDetailError] = useState(false);
  const detailRun = useRef(0);

  function mirrorSlug(slug: string | null) {
    const url = new URL(window.location.href);
    if (slug) url.searchParams.set("p", slug);
    else url.searchParams.delete("p");
    window.history.replaceState(null, "", url);
  }

  async function openCard(slug: string) {
    const run = ++detailRun.current;
    setDetailError(false);
    try {
      const res = await fetch(`/api/public/discover/${encodeURIComponent(slug)}`);
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as DiscoverDetail;
      if (run !== detailRun.current) return;
      setDetail(next);
      setDialogOpen(true);
      mirrorSlug(slug);
    } catch {
      if (run === detailRun.current) setDetailError(true);
    }
  }

  function onDialogOpenChange(next: boolean) {
    setDialogOpen(next);
    if (!next) mirrorSlug(null);
  }

  async function loadMore() {
    if (!cursor || loadingMore) return;
    const run = generation.current;
    setLoadingMore(true);
    setLoadError(false);
    const params = new URLSearchParams({ cursor });
    if (initialCategory) params.set("category", initialCategory);
    if (initialQuery.trim()) params.set("q", initialQuery.trim());
    try {
      const res = await fetch(`/api/public/discover?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const page = (await res.json()) as { items: DiscoverCard[]; nextCursor: string | null };
      if (run !== generation.current) return;
      setItems((prev) => [...prev, ...page.items]);
      setCursor(page.nextCursor);
    } catch {
      if (run === generation.current) setLoadError(true);
    } finally {
      if (run === generation.current) setLoadingMore(false);
    }
  }
  const categoryRef = useRef(initialCategory);
  const searchTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(searchTimer.current), []);

  function navigate(nextCategory: BusinessType | null, nextQuery: string) {
    const params = new URLSearchParams();
    if (nextCategory) params.set("category", nextCategory);
    if (nextQuery) params.set("q", nextQuery);
    const search = params.toString();
    startTransition(() => router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }));
  }

  function pick(next: BusinessType | null) {
    window.clearTimeout(searchTimer.current);
    categoryRef.current = next;
    setCategory(next);
    navigate(next, query.trim());
  }

  function search(value: string) {
    setQuery(value);
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => navigate(categoryRef.current, value.trim()), SEARCH_DEBOUNCE_MS);
  }

  function clearFilters() {
    window.clearTimeout(searchTimer.current);
    categoryRef.current = null;
    setCategory(null);
    setQuery("");
    navigate(null, "");
  }

  const filtered = category !== null || query.trim() !== "";
  const chip =
    "h-9 shrink-0 cursor-pointer rounded-[var(--radius)] border border-border px-3.5 text-sm font-medium outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground motion-reduce:transition-none";

  // Brand tiles may use a Google heading font (runtime data, so a <link>, not next/font).
  const googleFamilies = collectGoogleFontFamilies([items.map((i) => i.brand.headingFont), detail?.brand.headingFont]);

  return (
    <div>
      <GoogleFontLinks families={googleFamilies} />
      <div className="grid gap-4 border-b border-border pb-4">
        <div className="relative max-w-sm">
          <label htmlFor="discover-search" className="sr-only">
            {t("searchLabel")}
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            id="discover-search"
            type="search"
            value={query}
            onChange={(event) => search(event.target.value)}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            className="h-10 w-full rounded-[var(--radius)] border border-border bg-card ps-9 pe-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div role="group" aria-label={t("filterLabel")} className="-mx-4 flex gap-2 overflow-x-auto px-4 min-[760px]:mx-0 min-[760px]:flex-wrap min-[760px]:px-0">
          <button type="button" aria-pressed={category === null} onClick={() => pick(null)} className={chip}>
            {t("all")}
          </button>
          {CATEGORIES.map((value) => (
            <button key={value} type="button" aria-pressed={category === value} onClick={() => pick(value)} className={chip}>
              {tCategory(`businessType.${value}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5" aria-busy={pending}>
        {detailError ? (
          <p role="alert" className="mb-4 border border-destructive/40 px-3 py-2 text-sm text-destructive">
            {t("error.detail")}
          </p>
        ) : null}
        <p role="status" className="sr-only">
          {pending ? t("loading") : items.length > 0 ? t("count", { count: items.length }) : ""}
        </p>
        {pending ? (
          <ul aria-hidden="true" className={COLUMNS}>
            {SKELETON_RATIOS.map((ratio, i) => (
              <li key={i} className={COLUMN_ITEM}>
                <div className="w-full animate-pulse bg-muted motion-reduce:animate-none" style={{ aspectRatio: ratio }} />
              </li>
            ))}
          </ul>
        ) : items.length === 0 ? (
          <div className="grid justify-items-center gap-2 border border-dashed border-border px-4 py-16 text-center">
            <h2 className="text-xl font-bold tracking-tight">{filtered ? t("noResults.title") : t("empty.title")}</h2>
            <p className="max-w-[30rem] text-pretty text-muted-foreground">
              {filtered ? t("noResults.body") : t("empty.body")}
            </p>
            {filtered ? (
              <Button type="button" variant="outline" className="mt-3 h-10 px-4 text-sm" onClick={clearFilters}>
                {t("noResults.clear")}
              </Button>
            ) : (
              <Link href="/sign-up" className={cn(buttonVariants({ variant: "brand" }), "mt-3 h-10 px-4 text-sm font-semibold")}>
                {t("empty.cta")}
              </Link>
            )}
          </div>
        ) : (
          <>
            <ul className={COLUMNS}>
              {items.map((item) => (
                <li key={item.slug} className={COLUMN_ITEM}>
                  <DiscoverTile card={item} onOpen={openCard} />
                </li>
              ))}
            </ul>
            <div className="mt-6 grid justify-items-center gap-2 text-sm text-muted-foreground">
              {loadError ? <p role="alert">{t("error.list")}</p> : null}
              {cursor ? (
                <Button type="button" variant="outline" className="h-10 px-4 text-sm" loading={loadingMore} onClick={loadMore}>
                  {loadingMore ? t("loadingMore") : loadError ? t("error.retry") : t("loadMore")}
                </Button>
              ) : (
                <p>{t("end")}</p>
              )}
            </div>
          </>
        )}
      </div>
      <DiscoverDialog detail={detail} open={dialogOpen} onOpenChange={onDialogOpenChange} />
    </div>
  );
}
