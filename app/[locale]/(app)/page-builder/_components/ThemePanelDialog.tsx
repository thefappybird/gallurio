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
  onOpenChange: (open: boolean) => void;
  brandKit: PortfolioBrandKit;
  /** Live preview: applied to the canvas immediately as the owner edits. */
  onBrandKitChange: (next: PortfolioBrandKit) => void;
};

export function ThemePanelDialog({ open, onOpenChange, brandKit, onBrandKitChange }: Props) {
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
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("themeDialog.title")}</DialogTitle>
        </DialogHeader>
        <BrandKitPicker value={brandKit} onChange={onBrandKitChange} />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
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
