"use client";

import { Languages } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
// ponytail: buttonVariants used for trigger; Button used for dir toggle
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

const LOCALES = [
  { value: "en", label: "English" },
  { value: "fil", label: "Filipino" },
  { value: "ms", label: "Bahasa Melayu" },
  { value: "id", label: "Bahasa Indonesia" },
  { value: "ar", label: "العربية" },
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

  const isAr = value === "ar";

  return (
    <div className="flex items-center gap-1">
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
          {LOCALES.map(({ value: v, label }) => (
            <DropdownMenuItem
              key={v}
              aria-selected={value === v}
              onClick={() => onChange(v)}
            >
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {isAr && (
        <div
          role="group"
          aria-label={t("controls.directionLabel")}
          className="flex items-center gap-0.5"
        >
          <Button
            type="button"
            size="icon-sm"
            variant={dir === "ltr" ? "default" : "outline"}
            aria-pressed={dir === "ltr"}
            onClick={() => onDirChange("ltr")}
            title={t("controls.directionLtr")}
            aria-label={t("controls.directionLtr")}
          >
            LTR
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant={dir === "rtl" ? "default" : "outline"}
            aria-pressed={dir === "rtl"}
            onClick={() => onDirChange("rtl")}
            title={t("controls.directionRtl")}
            aria-label={t("controls.directionRtl")}
          >
            RTL
          </Button>
        </div>
      )}
    </div>
  );
}
