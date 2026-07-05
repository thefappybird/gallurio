"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { toast } from "sonner";
import { useActionError } from "@/lib/i18n/actionError";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { ColorPicker } from "@/components/ui/color-picker";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { CheckIcon } from "lucide-react";
import { INVOICE_THEME_PRESETS, type InvoiceThemePresetId } from "@/lib/invoices/theme";
import { updateInvoiceThemeAction } from "../_actions";
import { cn } from "@/lib/utils";

type ThemeValue = {
  preset: InvoiceThemePresetId | "custom";
  main: string;
  accent: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  initialTheme: ThemeValue;
};

const PRESET_IDS: InvoiceThemePresetId[] = ["classic", "slate", "navyGold", "forest"];

export function InvoiceThemeDialog({ open, onClose, initialTheme }: Props) {
  const t = useTranslations("app.bookings.invoiceThemeDialog");
  const router = useRouter();
  const errMsg = useActionError();
  const [preset, setPreset] = useState<InvoiceThemePresetId | "custom">(initialTheme.preset);
  const [customMain, setCustomMain] = useState(initialTheme.main);
  const [customAccent, setCustomAccent] = useState(initialTheme.accent);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const colors = preset === "custom"
      ? { main: customMain, accent: customAccent }
      : INVOICE_THEME_PRESETS[preset];
    const result = await updateInvoiceThemeAction({ preset, ...colors });
    setSaving(false);
    if ("error" in result) {
      toast.error(errMsg(result.error));
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogTitle>{t("title")}</DialogTitle>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRESET_IDS.map((id) => {
            const colors = INVOICE_THEME_PRESETS[id];
            return (
              <button
                key={id}
                type="button"
                aria-pressed={preset === id}
                onClick={() => setPreset(id)}
                className={cn(
                  "flex items-center gap-2 border border-border p-2 text-start text-sm",
                  preset === id && "border-brand"
                )}
              >
                <span className="flex">
                  <span className="size-5" style={{ background: colors.main }} aria-hidden />
                  <span className="size-5" style={{ background: colors.accent }} aria-hidden />
                </span>
                <span className="flex-1">{t(`presets.${id}`)}</span>
                {preset === id ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={preset === "custom"}
            onClick={() => setPreset("custom")}
            className={cn(
              "flex items-center gap-2 border border-border p-2 text-start text-sm",
              preset === "custom" && "border-brand"
            )}
          >
            <span className="flex-1">{t("presets.custom")}</span>
            {preset === "custom" ? <CheckIcon className="size-4 shrink-0" aria-hidden /> : null}
          </button>
        </div>
        {preset === "custom" ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Popover>
              <PopoverTrigger className="flex min-h-11 items-center gap-2 border border-border px-2 py-1.5 text-start text-sm">
                <span className="size-5 shrink-0 border border-border" style={{ background: customMain }} aria-hidden />
                {t("mainColor")}
              </PopoverTrigger>
              <PopoverContent className="w-auto" align="start">
                <ColorPicker value={customMain} onChange={setCustomMain} hexLabel={t("mainColor")} />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger className="flex min-h-11 items-center gap-2 border border-border px-2 py-1.5 text-start text-sm">
                <span className="size-5 shrink-0 border border-border" style={{ background: customAccent }} aria-hidden />
                {t("accentColor")}
              </PopoverTrigger>
              <PopoverContent className="w-auto" align="start">
                <ColorPicker value={customAccent} onChange={setCustomAccent} hexLabel={t("accentColor")} />
              </PopoverContent>
            </Popover>
          </div>
        ) : null}
        <div className="flex justify-end gap-2">
          <DialogClose render={<Button type="button" variant="ghost" size="sm" />}>
            {t("cancel")}
          </DialogClose>
          <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
            {t("saveAndApply")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
