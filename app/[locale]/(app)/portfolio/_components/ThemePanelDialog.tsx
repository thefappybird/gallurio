"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandKitPicker } from "@/lib/page-builder/brandKitPicker/BrandKitPicker";
import type { PortfolioBrandKit, PortfolioSavedTheme } from "@/lib/page-builder/types";
import { updateBrandKitAction, saveThemeAction, deleteThemeAction } from "../_actions";

type Props = {
  open: boolean;
  brandKit: PortfolioBrandKit;
  /** Live preview: applied to the canvas immediately as the owner edits. */
  onBrandKitChange: (next: PortfolioBrandKit) => void;
  /** Persisted successfully — parent closes and keeps the change. */
  onSaved: () => void;
  /** Closed without saving — parent reverts the canvas to the snapshot. */
  onCancel: () => void;
  /** Workspace's saved named themes (server-loaded, kept in sync here). */
  savedThemes: PortfolioSavedTheme[];
  /** Optimistic updater: called after a theme is saved/deleted. */
  onSavedThemesChange: (next: PortfolioSavedTheme[]) => void;
};

export function ThemePanelDialog({
  open,
  brandKit,
  onBrandKitChange,
  onSaved,
  onCancel,
  savedThemes,
  onSavedThemesChange,
}: Props) {
  const t = useTranslations("app.pageBuilder.editor");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const res = await updateBrandKitAction(brandKit);
      if ("error" in res) {
        toast.error(t("errorToast"));
        return;
      }
      toast.success(t("savedToast"));
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveTheme(name: string) {
    const res = await saveThemeAction(name, brandKit);
    if ("error" in res) {
      throw new Error(res.error);
    }
    onSavedThemesChange([...savedThemes, res.theme]);
  }

  async function handleDeleteTheme(id: string) {
    // Optimistic remove, with a real rollback if the server rejects — never
    // leave the UI showing the theme gone while it still exists in the DB.
    const previous = savedThemes;
    onSavedThemesChange(previous.filter((t) => t.id !== id));
    const res = await deleteThemeAction(id);
    if ("error" in res) {
      onSavedThemesChange(previous);
      toast.error("Could not delete theme. Please try again.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="flex max-h-[100dvh] h-[100dvh] w-screen max-w-[100vw] flex-col overflow-hidden sm:h-auto sm:max-h-[85vh] sm:w-auto sm:max-w-2xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("themeDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
          <BrandKitPicker
            value={brandKit}
            onChange={onBrandKitChange}
            savedThemes={savedThemes}
            onSaveTheme={handleSaveTheme}
            onDeleteTheme={handleDeleteTheme}
          />
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t("publishDialog.cancel")}
          </Button>
          <Button type="button" onClick={save} loading={saving}>
            {saving ? t("save.saving") : t("contactDialog.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
