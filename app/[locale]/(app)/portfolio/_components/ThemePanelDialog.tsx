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
import { useThemeEditor } from "@/lib/page-builder/brandKitPicker/useThemeEditor";
import { ConfirmDialog } from "@/lib/page-builder/brandKitPicker/ConfirmDialog";
import {
  type PortfolioBrandKit,
  type PortfolioSavedTheme,
} from "@/lib/page-builder/types";
import {
  updateBrandKitAction,
  saveThemeAction,
  deleteThemeAction,
  updateThemeAction,
} from "../_actions";

type Props = {
  open: boolean;
  brandKit: PortfolioBrandKit;
  /** Live preview: applied to the canvas immediately as the owner edits. */
  onBrandKitChange: (next: PortfolioBrandKit) => void;
  /** Persisted successfully - parent closes and keeps the change. */
  onSaved: () => void;
  /** Closed without saving - parent reverts the canvas to the snapshot. */
  onCancel: () => void;
  /** Workspace's saved named themes (server-loaded, kept in sync here). */
  savedThemes: PortfolioSavedTheme[];
  /** Optimistic updater: called after a theme is saved/updated/deleted. */
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
  const tk = useTranslations("app.pageBuilder.brandKit");
  const [saving, setSaving] = useState(false);
  const [closeGuardOpen, setCloseGuardOpen] = useState(false);

  const onSaveTheme = async (name: string) => {
    const res = await saveThemeAction(name, brandKit);
    if ("ok" in res) onSavedThemesChange([...savedThemes, res.theme]);
    return res;
  };

  const controller = useThemeEditor({
    value: brandKit,
    onChange: onBrandKitChange,
    savedThemes,
    onSaveTheme,
    onUpdateTheme: async (id, name, kit) => {
      const res = await updateThemeAction(id, name, kit);
      if ("ok" in res) {
        onSavedThemesChange(savedThemes.map((s) => (s.id === id ? res.theme : s)));
      }
      return res;
    },
  });

  async function persistPage(): Promise<boolean> {
    setSaving(true);
    try {
      const res = await updateBrandKitAction(brandKit);
      if ("error" in res) {
        toast.error(t("errorToast"));
        return false;
      }
      toast.success(t("savedToast"));
      onSaved();
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function apply() {
    if (controller.hasUnsavedCurrent) {
      const ok = await controller.saveCurrentTheme();
      if (!ok) return;
    }
    await persistPage();
  }

  async function handleDeleteTheme(id: string) {
    const previous = savedThemes;
    onSavedThemesChange(previous.filter((s) => s.id !== id));
    const res = await deleteThemeAction(id);
    if ("error" in res) {
      onSavedThemesChange(previous);
      toast.error("Could not delete theme. Please try again.");
    }
  }

  function attemptClose() {
    if (controller.editDiff) {
      controller.requestExit(() => {
        if (controller.hasUnsavedCurrent) setCloseGuardOpen(true);
        else onCancel();
      });
      return;
    }
    if (controller.hasUnsavedCurrent) {
      setCloseGuardOpen(true);
      return;
    }
    onCancel();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) attemptClose(); }}>
        <DialogContent className="flex max-h-[100dvh] h-[100dvh] w-screen max-w-[100vw] flex-col overflow-hidden sm:h-auto sm:max-h-[85vh] sm:w-auto sm:max-w-2xl lg:max-w-4xl">
          <DialogHeader>
            <DialogTitle>{t("themeDialog.title")}</DialogTitle>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-1 py-2">
            <BrandKitPicker
              value={brandKit}
              onChange={onBrandKitChange}
              controller={controller}
              savedThemes={savedThemes}
              onSaveTheme={onSaveTheme}
              onDeleteTheme={handleDeleteTheme}
              onUpdateTheme={updateThemeAction}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={attemptClose} disabled={saving}>
              {t("publishDialog.cancel")}
            </Button>
            <Button type="button" onClick={() => void apply()} loading={saving}>
              {saving ? t("save.saving") : tk("applyAction")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={closeGuardOpen}
        title={tk("unsavedChangesTitle")}
        body={tk("unsavedChangesBody")}
        confirmLabel={tk("saveAndCloseAction")}
        cancelLabel={tk("discardAction")}
        onConfirm={async () => {
          setCloseGuardOpen(false);
          const ok = await controller.saveCurrentTheme();
          if (ok) await persistPage();
        }}
        onCancel={() => { setCloseGuardOpen(false); onCancel(); }}
      />
    </>
  );
}
