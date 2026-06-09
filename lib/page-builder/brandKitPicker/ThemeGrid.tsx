"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  SAVED_THEMES_MAX,
  type PortfolioBrandKit,
  type PortfolioSavedTheme,
  type BrandKitThemePreset,
} from "@/lib/page-builder/types";
import {
  buildThemeTiles,
  filterThemeTiles,
  paginate,
  brandKitsEqualForSelection,
} from "./themeTiles";
import { ThemeTile } from "./ThemeTile";
import { SaveThemePopover } from "./SaveThemePopover";

type Props = {
  value: PortfolioBrandKit;
  onChange: (next: PortfolioBrandKit) => void;
  savedThemes: PortfolioSavedTheme[];
  onSaveTheme?: (name: string) => Promise<void>;
  onDeleteTheme?: (id: string) => Promise<void>;
};

export function ThemeGrid({ value, onChange, savedThemes, onSaveTheme, onDeleteTheme }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const presetName = (id: BrandKitThemePreset) => t(`presets.${id}`);
  const tiles = buildThemeTiles({ presetName, savedThemes });
  const filtered = filterThemeTiles(tiles, query);
  const { pageItems, pageCount, page: safePage } = paginate(filtered, page);

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteTheme?.(id);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setPage(0); }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-9 min-w-0 flex-1 border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {onSaveTheme && (
          <SaveThemePopover onSave={onSaveTheme} atLimit={savedThemes.length >= SAVED_THEMES_MAX} />
        )}
      </div>

      {/* Grid / empty state */}
      {pageItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pageItems.map((tile) => (
            <ThemeTile
              key={tile.key}
              tile={tile}
              selected={brandKitsEqualForSelection(tile.brandKit, value)}
              applyLabel={t("applyTheme", { name: tile.name })}
              deleteLabel={
                tile.savedThemeId && onDeleteTheme
                  ? t("deleteTheme", { name: tile.name })
                  : undefined
              }
              deleting={deletingId === tile.savedThemeId}
              onApply={() => onChange(tile.brandKit)}
              onDelete={
                tile.savedThemeId ? () => void handleDelete(tile.savedThemeId!) : undefined
              }
            />
          ))}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("noThemesMatch")}</p>
      )}

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            aria-label={t("prevPage")}
            disabled={safePage === 0}
            onClick={() => setPage(safePage - 1)}
            className="inline-flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
          >
            <ChevronLeftIcon className="size-4" aria-hidden />
          </button>
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("pageIndicator", { current: safePage + 1, total: pageCount })}
          </span>
          <button
            type="button"
            aria-label={t("nextPage")}
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage(safePage + 1)}
            className="inline-flex size-8 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-40"
          >
            <ChevronRightIcon className="size-4" aria-hidden />
          </button>
        </div>
      )}
    </section>
  );
}
