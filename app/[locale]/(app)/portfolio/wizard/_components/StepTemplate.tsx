"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { WizardTemplateSummary } from "./WizardClient";
import type { PortfolioTemplateId } from "@/lib/page-builder/templates/types";

type Props = {
  templates: WizardTemplateSummary[];
  selectedId: PortfolioTemplateId;
  onSelect: (id: PortfolioTemplateId) => void;
};

export function StepTemplate({ templates, selectedId, onSelect }: Props) {
  const t = useTranslations("app.pageBuilder.wizard.template");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {templates.map((tpl) => {
          const active = tpl.id === selectedId;
          const bk = tpl.defaultBrandKit;
          return (
            <button
              key={tpl.id}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(tpl.id)}
              className={cn(
                "flex flex-col gap-3 border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                active ? "border-foreground" : "border-border hover:bg-accent/40"
              )}
            >
              {/* Mini preview built from the template's palette (no asset fetch). */}
              <span
                className="flex h-24 w-full flex-col justify-end gap-1.5 border border-border p-2"
                style={{ background: bk.backgroundColor }}
                aria-hidden
              >
                <span className="h-2 w-1/2" style={{ background: bk.foregroundColor }} />
                <span className="h-1.5 w-3/4" style={{ background: bk.foregroundColor, opacity: 0.45 }} />
                <span className="mt-1 h-4 w-20" style={{ background: bk.accentColor }} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{tpl.label}</span>
                  {active && <span className="text-xs text-muted-foreground">✓</span>}
                </span>
                <span className="text-xs text-muted-foreground">{tpl.description}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
