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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BRAND_KIT_BUTTON_STYLES,
  CONTACT_BUTTON_COLORS,
  type PortfolioContactConfig,
} from "@/lib/page-builder/types";
import { updateContactConfigAction } from "../_actions";

type Props = {
  open: boolean;
  contact: PortfolioContactConfig;
  onContactChange: (next: PortfolioContactConfig) => void;
  /** Persisted successfully — parent closes and keeps the change. */
  onSaved: () => void;
  /** Closed without saving — parent reverts to the snapshot. */
  onCancel: () => void;
};

const selectClass =
  "min-h-9 w-full border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function ContactPanelDialog({ open, contact, onContactChange, onSaved, onCancel }: Props) {
  const t = useTranslations("app.pageBuilder.editor.contactDialog");
  const te = useTranslations("app.pageBuilder.editor");
  const [saving, setSaving] = useState(false);

  function set<K extends keyof PortfolioContactConfig>(key: K, value: PortfolioContactConfig[K]) {
    onContactChange({ ...contact, [key]: value });
  }

  async function save() {
    setSaving(true);
    try {
      const res = await updateContactConfigAction(contact);
      if ("error" in res) {
        toast.error(te("errorToast"));
        return;
      }
      toast.success(te("savedToast"));
      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{t("formFixedNote")}</p>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-title">{t("titleLabel")}</Label>
            <Input
              id="contact-title"
              value={contact.title ?? ""}
              maxLength={80}
              placeholder={t("titlePlaceholder")}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="contact-description">{t("descriptionLabel")}</Label>
            <Textarea
              id="contact-description"
              rows={3}
              value={contact.description ?? ""}
              maxLength={280}
              placeholder={t("descriptionPlaceholder")}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-button-style">{t("buttonStyleLabel")}</Label>
              <select
                id="contact-button-style"
                className={selectClass}
                value={contact.buttonStyle ?? ""}
                onChange={(e) =>
                  set("buttonStyle", (e.target.value || undefined) as PortfolioContactConfig["buttonStyle"])
                }
              >
                {BRAND_KIT_BUTTON_STYLES.map((s) => (
                  <option key={s} value={s}>
                    {t(`buttonStyles.${s}`)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="contact-button-color">{t("buttonColorLabel")}</Label>
              <select
                id="contact-button-color"
                className={selectClass}
                value={contact.buttonColor ?? ""}
                onChange={(e) =>
                  set("buttonColor", (e.target.value || undefined) as PortfolioContactConfig["buttonColor"])
                }
              >
                {CONTACT_BUTTON_COLORS.map((c) => (
                  <option key={c} value={c}>
                    {t(`buttonColors.${c}`)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {te("publishDialog.cancel")}
          </Button>
          <Button type="button" onClick={save} loading={saving}>
            {saving ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
