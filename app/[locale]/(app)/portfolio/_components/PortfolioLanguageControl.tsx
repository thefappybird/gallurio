"use client";

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "ar", label: "العربية" },
  { value: "th", label: "ภาษาไทย" },
] as const;

type FormLocale = (typeof LOCALES)[number]["value"] | "";

export type PortfolioLanguageControlProps = {
  value: FormLocale;
  onChange: (value: FormLocale) => void;
  dir: "ltr" | "rtl";
  onDirChange: (dir: "ltr" | "rtl") => void;
};

export function PortfolioLanguageControl({
  value,
  onChange,
  dir,
  onDirChange,
}: PortfolioLanguageControlProps) {
  const t = useTranslations("app.pageBuilder.editor");
  void dir;
  void onDirChange;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("controls.language")}
        title={t("controls.language")}
        data-testid="language-control"
        data-tour-id="language-control"
        className={buttonVariants({ variant: "outline", size: "icon-sm" })}
      >
        <Languages className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={value}
          onValueChange={(v) => onChange(v as FormLocale)}
        >
          {LOCALES.map(({ value: v, label }) => (
            <DropdownMenuRadioItem key={v} value={v}>
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
