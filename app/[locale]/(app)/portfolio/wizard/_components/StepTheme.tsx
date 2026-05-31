"use client";

import { useTranslations } from "next-intl";
import { BrandKitPicker } from "@/lib/page-builder/brandKitPicker/BrandKitPicker";
import type { PortfolioBrandKit } from "@/lib/page-builder/types";

type Props = {
  brandKit: PortfolioBrandKit;
  onBrandKitChange: (next: PortfolioBrandKit) => void;
  workspaceBranding: { primaryColor: string; secondaryColor: string };
};

export function StepTheme({ brandKit, onBrandKitChange, workspaceBranding }: Props) {
  const t = useTranslations("app.pageBuilder.wizard.theme");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <BrandKitPicker
        value={brandKit}
        onChange={onBrandKitChange}
        workspaceBranding={workspaceBranding}
      />
    </section>
  );
}
