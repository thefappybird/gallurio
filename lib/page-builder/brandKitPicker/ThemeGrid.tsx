"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import {
  type PortfolioBrandKit,
  type PortfolioSavedTheme,
  type BrandKitThemePreset,
} from "@/lib/page-builder/types";
import {
  buildThemeTiles,
  buildCurrentTile,
  filterThemeTiles,
  paginateWithCurrent,
  brandKitsEqualForSelection,
  type ThemeTileModel,
} from "./themeTiles";
import { ThemeTile } from "./ThemeTile";
import { ConfirmDialog } from "./ConfirmDialog";
import type { ThemeEditorController } from "./useThemeEditor";
import type { ThemeNameError } from "./useThemeEditor";

type Props = {
  value: PortfolioBrandKit;
  savedThemes: PortfolioSavedTheme[];
  controller: ThemeEditorController;
  onDeleteTheme?: (id: string) => Promise<void>;
  /** Called when user clicks "Add new theme"; parent handles the guard. */
  onAddNew?: () => void;
};

export function ThemeGrid({ value, savedThemes, controller, onDeleteTheme, onAddNew }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const presetName = (id: BrandKitThemePreset) => t(`presets.${id}`);
  const allTiles = buildThemeTiles({ presetName, savedThemes });
  const realTiles = filterThemeTiles(allTiles, query);
  const currentTile = controller.hasUnsavedCurrent
    ? buildCurrentTile(controller.currentTheme!, t("currentTheme"))
    : null;
  const { pageItems, pageCount, page: safePage } = paginateWithCurrent(realTiles, currentTile, page);

  const savedById = new Map(savedThemes.map((s) => [s.id, s]));

  const activeName =
    controller.selection.kind === "tile"
      ? allTiles.find((tile) => tile.key === (controller.selection as { kind: "tile"; key: string }).key)?.name ?? ""
      : "";

  function isSelected(tile: ThemeTileModel): boolean {
    if (tile.variant === "current") return controller.selection.kind === "current";
    return (
      brandKitsEqualForSelection(tile.brandKit, value) && controller.selection.kind !== "current"
    );
  }

  function applyWithGuard(tile: ThemeTileModel) {
    controller.requestExit(() => controller.applyTile(tile));
  }
  function editWithGuard(theme: PortfolioSavedTheme) {
    controller.requestExit(() => controller.enterEdit(theme));
  }
  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await onDeleteTheme?.(id);
    } finally {
      setDeletingId(null);
    }
  }

  const nameErrMsg = (c: ThemeNameError | null): string | null =>
    c ? t(({ required: "enterThemeName", tooLong: "nameTooLong", duplicate: "themeNameExists", saveFailed: "saveThemeError" } as Record<ThemeNameError, string>)[c]) : null;

  return (
    <section aria-label={t("themes")} className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="h-9 min-w-0 flex-1 border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {pageItems.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {pageItems.map((tile) => {
            const saved = tile.savedThemeId ? savedById.get(tile.savedThemeId) : undefined;
            const isEditingThisTile = !!saved && controller.editing?.id === saved.id;

            if (tile.variant === "current") {
              return (
                <ThemeTile
                  key={tile.key}
                  tile={tile}
                  selected={isSelected(tile)}
                  applyLabel={t("applyTheme", { name: tile.name })}
                  nameEditing={true}
                  nameValue={controller.currentThemeName}
                  onNameChange={controller.setCurrentThemeName}
                  onSaveName={() => void controller.saveCurrentTheme()}
                  saveNameLabel={t("saveThemeName")}
                  cancelNameLabel={t("cancelThemeEdit")}
                  onCancelName={controller.discardCurrentTheme}
                  namePlaceholder={t("themeNamePlaceholder")}
                  savingName={controller.savingCurrentTheme}
                  nameError={nameErrMsg(controller.currentThemeNameError)}
                  onApply={() => applyWithGuard(tile)}
                />
              );
            }

            if (isEditingThisTile && saved) {
              return (
                <ThemeTile
                  key={tile.key}
                  tile={tile}
                  selected={isSelected(tile)}
                  editing={true}
                  applyLabel={t("applyTheme", { name: tile.name })}
                  nameEditing={true}
                  nameValue={controller.editName}
                  onNameChange={controller.changeEditName}
                  onSaveName={() => void controller.saveAndExitEdit()}
                  saveNameLabel={t("saveThemeName")}
                  namePlaceholder={t("themeNamePlaceholder")}
                  savingName={controller.editSaving}
                  nameError={nameErrMsg(controller.editGuardError)}
                  onApply={() => applyWithGuard(tile)}
                />
              );
            }

            return (
              <ThemeTile
                key={tile.key}
                tile={tile}
                selected={isSelected(tile)}
                editing={isEditingThisTile}
                applyLabel={t("applyTheme", { name: tile.name })}
                editLabel={saved ? t("editTheme", { name: tile.name }) : undefined}
                deleteLabel={saved && onDeleteTheme ? t("deleteTheme", { name: tile.name }) : undefined}
                deleting={deletingId === tile.savedThemeId}
                onApply={() => applyWithGuard(tile)}
                onEdit={saved ? () => editWithGuard(saved) : undefined}
                onDelete={saved && onDeleteTheme ? () => void handleDelete(saved.id) : undefined}
              />
            );
          })}
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted-foreground">{t("noThemesMatch")}</p>
      )}

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

      <button
        type="button"
        onClick={onAddNew}
        className="flex w-full items-center justify-center gap-2 border border-dashed border-border py-2 text-sm text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {t("addNewTheme")}
      </button>

      <ConfirmDialog
        open={controller.overrideOpen}
        title={t("overrideCurrentTitle")}
        body={t("overrideCurrentBody", { name: activeName })}
        confirmLabel={t("continueAction")}
        cancelLabel={t("cancelAction")}
        onConfirm={controller.confirmOverride}
        onCancel={controller.cancelOverride}
      />
    </section>
  );
}
