"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

type Props = {
  name: string;
  onNameChange: (name: string) => void;
  onExit: () => void;
};

export function EditThemeBar({ name, onNameChange, onExit }: Props) {
  const t = useTranslations("app.pageBuilder.brandKit");
  return (
    <div className="flex items-center gap-2 border border-foreground bg-accent/20 p-2">
      <input
        type="text"
        value={name}
        maxLength={60}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder={t("editThemeName")}
        aria-label={t("editThemeName")}
        className="h-9 min-w-0 flex-1 border border-border bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      <Button type="button" size="sm" variant="outline" onClick={onExit} className="gap-1.5">
        <XIcon className="size-3.5" aria-hidden />
        {t("cancelAction")}
      </Button>
    </div>
  );
}
