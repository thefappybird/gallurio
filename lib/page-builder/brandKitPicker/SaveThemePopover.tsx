"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { SaveIcon, Loader2Icon } from "lucide-react";
import { SAVED_THEMES_MAX } from "@/lib/page-builder/types";
import { normalizeThemeName } from "@/lib/page-builder/themeNames";

type Props = {
  /** Persist the current brand kit under `name`. Rejects on failure. */
  onSave: (name: string) => Promise<void>;
  /** True when the workspace is at `SAVED_THEMES_MAX` saved themes. */
  atLimit: boolean;
  /** Existing names (any case) to reject as duplicates before saving. */
  takenNames?: string[];
  /** Optional controlled open state (used by the close-guard). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

export function SaveThemePopover({ onSave, atLimit, takenNames, open, onOpenChange }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = (o: boolean) => {
    onOpenChange?.(o);
    if (open === undefined) setInternalOpen(o);
    if (!o) setError(null);
  };
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError(t("enterThemeName"));
      return;
    }
    if (trimmed.length > 60) {
      setError(t("nameTooLong"));
      return;
    }
    if ((takenNames ?? []).some((n) => normalizeThemeName(n) === normalizeThemeName(trimmed))) {
      setError(t("themeNameExists"));
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave(trimmed);
      setName("");
      setOpen(false);
    } catch {
      setError(t("saveThemeError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={atLimit}
        title={atLimit ? t("themeLimitReached", { max: SAVED_THEMES_MAX }) : t("saveCurrentAsTheme")}
        aria-label={atLimit ? t("themeLimitReached", { max: SAVED_THEMES_MAX }) : t("saveCurrentAsTheme")}
        className="inline-flex size-9 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:bg-accent/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
      >
        <SaveIcon className="size-4" aria-hidden />
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-64 flex-col gap-2">
        <input
          type="text"
          autoFocus
          placeholder={t("themeNamePlaceholder")}
          aria-label={t("themeNamePlaceholder")}
          value={name}
          maxLength={60}
          onChange={(e) => { setName(e.target.value); setError(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); }}
          className="h-9 w-full min-w-0 border border-border bg-background px-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
        <Button
          type="button"
          size="sm"
          onClick={() => void handleSave()}
          disabled={saving}
          className="gap-1.5 self-end"
        >
          {saving && <Loader2Icon className="size-3.5 animate-spin" aria-hidden />}
          {t("saveAction")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
