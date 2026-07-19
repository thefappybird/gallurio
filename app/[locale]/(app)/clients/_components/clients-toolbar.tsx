"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PlusIcon, SearchIcon, ChevronDownIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ClearFiltersButton } from "@/components/app/clear-filters-button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

const ALL = "__all__";

type Props = {
  availableTags: string[];
  onAddClient: () => void;
};

export function ClientsToolbar({ availableTags, onAddClient }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("app.clients");
  const [, startTransition] = useTransition();

  const [q, setQ] = useState(searchParams.get("q") ?? "");

  // Sync search input with URL (e.g. back/forward nav)
  useEffect(() => {
    const next = searchParams.get("q") ?? "";
    Promise.resolve().then(() => setQ(next));
  }, [searchParams]);

  const source = searchParams.get("source") ?? ALL;
  const includeInactive = searchParams.get("includeInactive") === "1";
  const selectedTags = searchParams.get("tags")
    ? searchParams.get("tags")!.split(",").filter(Boolean)
    : [];

  const pushParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      // always reset page when filters change
      params.delete("page");
      const qs = params.toString();
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname);
      });
    },
    [router, pathname, searchParams]
  );

  // 250ms debounce on search
  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (q === current) return;
    const id = setTimeout(() => pushParams({ q: q || null }), 250);
    return () => clearTimeout(id);
  }, [q, searchParams, pushParams]);

  function toggleTag(tag: string) {
    const next = selectedTags.includes(tag)
      ? selectedTags.filter((t) => t !== tag)
      : [...selectedTags, tag];
    pushParams({ tags: next.length ? next.join(",") : null });
  }

  const sources = ["form", "manual", "referral", "import"] as const;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:w-80">
          <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("toolbar.search")}
            aria-label={t("toolbar.searchLabel")}
            className="ps-8"
          />
        </div>

        {/* Source filter */}
        <Select<string>
          value={source}
          onValueChange={(v) =>
            pushParams({ source: !v || v === ALL ? null : v })
          }
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue>
              {(value: string) =>
                !value || value === ALL ? (
                  <span>{t("toolbar.sourceAll")}</span>
                ) : (
                  <span className="capitalize">{t(`sourceValues.${value}` as Parameters<typeof t>[0])}</span>
                )
              }
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t("toolbar.sourceAll")}</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`sourceValues.${s}` as Parameters<typeof t>[0])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Tags multi-select */}
        {availableTags.length > 0 && (
          <Popover>
            <PopoverTrigger
              className="flex h-11 w-full items-center justify-between border border-input bg-background px-3 text-sm sm:h-9 sm:w-44"
              aria-label={
                selectedTags.length > 0
                  ? t("toolbar.tagsSelected", { count: selectedTags.length })
                  : t("toolbar.tagsAll")
              }
            >
              {selectedTags.length > 0
                ? t("toolbar.tagsSelected", { count: selectedTags.length })
                : t("toolbar.tagsAll")}
              <ChevronDownIcon className="size-4 text-muted-foreground" />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-52 p-2">
              {availableTags.map((tag) => (
                <label
                  key={tag}
                  className="flex cursor-pointer items-center gap-2 px-1 py-1.5 text-sm hover:bg-accent"
                >
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggleTag(tag)}
                    className="size-4 accent-brand"
                  />
                  {tag}
                </label>
              ))}
            </PopoverContent>
          </Popover>
        )}

        {/* Show Inactive */}
        <label className="flex h-9 cursor-pointer items-center gap-2 text-sm">
          <Switch
            checked={includeInactive}
            onCheckedChange={(v: boolean) =>
              pushParams({ includeInactive: v ? "1" : null })
            }
          />
          <span className="select-none text-muted-foreground">
            {t("toolbar.showInactive")}
          </span>
        </label>
      </div>

      {/* Right-side controls */}
      <div className="flex items-center gap-2">
        <ClearFiltersButton
          paramKeys={["q", "source", "tags", "includeInactive"]}
        />
        <Button
          size="sm"
          className="bg-brand text-brand-foreground hover:bg-brand/90"
          onClick={onAddClient}
        >
          <PlusIcon className="size-4" />
          {t("toolbar.add")}
        </Button>
      </div>
    </div>
  );
}
