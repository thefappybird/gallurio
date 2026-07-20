"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner"; // still used by handleDeleteTheme
import { useActionError } from "@/lib/i18n/actionError";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { BrandKitPicker } from "@/lib/page-builder/brandKitPicker/BrandKitPicker";
import { useThemeEditor, type ThemeNameError } from "@/lib/page-builder/brandKitPicker/useThemeEditor";
import { ConfirmDialog } from "@/lib/page-builder/brandKitPicker/ConfirmDialog";
import { brandKitsEqualForSelection } from "@/lib/page-builder/brandKitPicker/themeTiles";
import { UnsavedChangesDialog } from "./UnsavedChangesDialog";
import {
  type PortfolioBrandKit,
  type PortfolioSavedTheme,
} from "@/lib/page-builder/types";
import {
  saveThemeAction,
  deleteThemeAction,
  updateThemeAction,
} from "../_actions";

const THEME_NAME_ERROR_KEYS: Record<ThemeNameError, string> = {
  required: "enterThemeName",
  tooLong: "nameTooLong",
  duplicate: "themeNameExists",
  saveFailed: "saveThemeError",
};

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
  const errMsg = useActionError();
  const [closeGuardOpen, setCloseGuardOpen] = useState(false);
  const [kitGuardOpen, setKitGuardOpen] = useState(false);
  const [applying, setApplying] = useState(false);
  // Delete-theme failure only — a separate concern from name-validation
  // errors below, which are computed at render from the shared controller
  // (the single source of truth) rather than tracked in local state.
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Snapshot of the brand kit as it was when the dialog opened, so any
  // unapplied edit (including just picking a different theme tile, which
  // doesn't set editDiff/hasUnsavedCurrent) can be detected and guarded on
  // close, and reverted on demand. Re-captured every time `open` flips true
  // (render-time state adjust, not an effect — the component stays mounted
  // across opens).
  const [openSnapshot, setOpenSnapshot] = useState<PortfolioBrandKit>(brandKit);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpenSnapshot(brandKit);
      setDeleteError(null);
    }
  }
  const brandKitDirty = !brandKitsEqualForSelection(brandKit, openSnapshot);

  function themeNameErrMsg(code: ThemeNameError | null): string | null {
    return code ? tk(THEME_NAME_ERROR_KEYS[code]) : null;
  }

  /** Reverts whatever draft/edit/plain-selection state is active back to a
   *  settled kit — used by both the close guard and the footer's "Discard
   *  changes" button. */
  function discardWorkingChanges() {
    if (controller.editDiff) {
      controller.discardEdit();
      return;
    }
    if (controller.hasUnsavedCurrent) {
      controller.discardCurrentTheme();
      return;
    }
    onBrandKitChange(openSnapshot);
  }

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

  // Single source of truth for the bottom name-validation message — derived
  // fresh every render from the controller (never a separate copy that can
  // desync from an inline Discard/typing/successful save). Current-draft and
  // saved-theme-edit sessions are mutually exclusive in practice, so at most
  // one of these is ever non-null.
  const nameError = controller.hasUnsavedCurrent
    ? themeNameErrMsg(controller.currentThemeNameError)
    : themeNameErrMsg(controller.editGuardError);

  // Brand-kit changes are kept in local state + the localStorage buffer;
  // the DB write happens only when the owner explicitly saves or publishes.
  function persistPage(): boolean {
    onSaved();
    return true;
  }

  async function saveCurrentThemeGuarded(): Promise<boolean> {
    return controller.saveCurrentTheme();
  }

  async function apply() {
    setApplying(true);
    try {
      if (controller.hasUnsavedCurrent) {
        const ok = await saveCurrentThemeGuarded();
        if (!ok) return;
      }
      persistPage();
    } finally {
      setApplying(false);
    }
  }

  async function handleDeleteTheme(id: string) {
    const previous = savedThemes;
    onSavedThemesChange(previous.filter((s) => s.id !== id));
    setDeleteError(null);
    const res = await deleteThemeAction(id);
    if ("error" in res) {
      onSavedThemesChange(previous);
      const msg = errMsg("theme_delete_failed");
      toast.error(msg);
      setDeleteError(msg);
    }
  }

  function attemptClose() {
    if (controller.editDiff) {
      controller.requestExit(() => {
        if (controller.hasUnsavedCurrent) setCloseGuardOpen(true);
        else if (brandKitDirty) setKitGuardOpen(true);
        else onCancel();
      });
      return;
    }
    if (controller.hasUnsavedCurrent) {
      setCloseGuardOpen(true);
      return;
    }
    if (brandKitDirty) {
      setKitGuardOpen(true);
      return;
    }
    onCancel();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => { if (!o) attemptClose(); }}>
        <DialogContent className="flex max-h-[100dvh] h-[100dvh] w-screen max-w-[100vw] flex-col overflow-hidden sm:h-auto sm:min-h-[520px] sm:max-h-[85vh] sm:w-full sm:max-w-2xl">
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
              onAddNew={() => controller.requestAddNew()}
            />
          </div>
          {(deleteError ?? nameError) && (
            <p role="alert" id="theme-name-error" className="px-1 text-xs text-destructive">
              {deleteError ?? nameError}
            </p>
          )}
          <DialogFooter className="sm:justify-between">
            <div className="flex flex-wrap gap-2">
              {controller.hasUnsavedCurrent && (
                <Button
                  type="button"
                  variant="outline"
                  aria-label="Save theme (current draft)"
                  onClick={() => void saveCurrentThemeGuarded()}
                  disabled={applying}
                >
                  {tk("saveThemeName")}
                </Button>
              )}
              {(controller.hasUnsavedCurrent || controller.editDiff || brandKitDirty) && (
                <Button type="button" variant="outline" onClick={discardWorkingChanges} disabled={applying}>
                  {tk("discardAction")}
                </Button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={attemptClose} disabled={applying}>
                {t("publishDialog.cancel")}
              </Button>
              <Button type="button" loading={applying} onClick={() => void apply()}>
                {tk("applyAction")}
              </Button>
            </div>
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
          const ok = await saveCurrentThemeGuarded();
          if (ok) persistPage();
        }}
        onCancel={() => { setCloseGuardOpen(false); onCancel(); }}
      />

      {/* Guards closing when the working brand kit diverged from the snapshot
          taken on open (e.g. a theme tile was picked) without editDiff/
          hasUnsavedCurrent already covering it — avoids double-prompting. */}
      <ConfirmDialog
        open={kitGuardOpen}
        title={tk("unsavedChangesTitle")}
        body={tk("unsavedChangesBody")}
        confirmLabel={tk("applyAction")}
        cancelLabel={tk("discardAction")}
        onConfirm={() => { setKitGuardOpen(false); persistPage(); }}
        onCancel={() => { setKitGuardOpen(false); discardWorkingChanges(); onCancel(); }}
      />

      <UnsavedChangesDialog
        open={controller.addNewGuardOpen}
        saving={controller.addNewGuardSaving}
        title={tk("addNewGuardTitle")}
        body={tk("addNewGuardBody")}
        name={controller.addNewGuardName}
        onNameChange={controller.setAddNewGuardName}
        nameLabel={tk("addNewGuardNameLabel")}
        nameError={controller.addNewGuardNameError
          ? tk(({ required: "enterThemeName", tooLong: "nameTooLong", duplicate: "themeNameExists", saveFailed: "saveThemeError" } as Record<string, string>)[controller.addNewGuardNameError])
          : null}
        onSave={() => void controller.saveAndAddNew()}
        onDiscard={controller.discardAndAddNew}
        onCancel={controller.cancelAddNew}
      />
    </>
  );
}
