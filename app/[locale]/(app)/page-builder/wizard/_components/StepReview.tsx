"use client";

import { useTranslations } from "next-intl";
import { getTemplate } from "@/lib/page-builder/templates";
import type { PortfolioBrandKit } from "@/lib/page-builder/types";
import type { WizardTemplateSummary } from "./WizardClient";

type Props = {
  template: WizardTemplateSummary;
  brandKit: PortfolioBrandKit;
  imageCount: number;
};

export function StepReview({ template, brandKit, imageCount }: Props) {
  const t = useTranslations("app.pageBuilder.wizard.review");
  const tp = useTranslations("app.pageBuilder.brandKit.presets");

  const seeded = getTemplate(template.id)?.seedData({ workspace: { name: "" } });
  const homeCount = seeded?.home?.content.length ?? 0;
  const galleryCount = seeded?.gallery?.content.length ?? 0;

  const presetLabel = (() => {
    try {
      return tp(brandKit.themePreset);
    } catch {
      return brandKit.themePreset;
    }
  })();

  const rows: Array<[string, string]> = [
    [t("template"), template.label],
    [t("theme"), presetLabel],
    [t("images"), String(imageCount)],
  ];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <dl className="divide-y divide-border border border-border">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 px-3 py-2.5">
          <dt className="text-sm text-muted-foreground">{t("homeBlocks", { count: homeCount })}</dt>
          <dd className="text-sm font-medium">{t("galleryBlocks", { count: galleryCount })}</dd>
        </div>
      </dl>

      {/* Brand palette preview */}
      <div className="flex items-center gap-2">
        {[brandKit.backgroundColor, brandKit.foregroundColor, brandKit.primaryColor, brandKit.accentColor].map(
          (c, i) => (
            <span key={i} className="size-8 border border-border" style={{ background: c }} aria-hidden />
          )
        )}
      </div>
    </section>
  );
}
