"use client";

import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Branding = { tagline: string; description: string };

type Props = {
  value: Branding;
  onChange: (next: Branding) => void;
};

export function StepBranding({ value, onChange }: Props) {
  const t = useTranslations("app.pageBuilder.wizard.branding");

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">{t("title")}</h2>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wizard-tagline">{t("tagline")}</Label>
        <Input
          id="wizard-tagline"
          value={value.tagline}
          maxLength={200}
          placeholder={t("taglinePlaceholder")}
          onChange={(e) => onChange({ ...value, tagline: e.target.value })}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="wizard-description">{t("description")}</Label>
        <Textarea
          id="wizard-description"
          rows={4}
          value={value.description}
          maxLength={2000}
          placeholder={t("descriptionPlaceholder")}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
        />
      </div>
    </section>
  );
}
