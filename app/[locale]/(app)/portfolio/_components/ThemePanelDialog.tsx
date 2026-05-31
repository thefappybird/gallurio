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
import type { PortfolioBrandKit } from "@/lib/page-builder/types";
import { updateBrandKitAction } from "../_actions";

type Props = {
  open: boolean;
  brandKit: PortfolioBrandKit;
  /** Live preview: applied to the canvas immediately as the owner edits. */
  onBrandKitChange: (next: PortfolioBrandKit) => void;
  /** Persisted successfully — parent closes and keeps the change. */
  onSaved: () => void;
  /** Closed without saving — parent reverts the canvas to the snapshot. */
  onCancel: () => void;
};

export function ThemePanelDialog({ open, brandKit, onBrandKitChange, onSaved, onCancel }: Props) {
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

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t("themeDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <BrandKitPicker value={brandKit} onChange={onBrandKitChange} />
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
