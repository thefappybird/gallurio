"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

// Shown only below the lg breakpoint (the editor is built for tablet/desktop).
// We communicate the constraint rather than blocking — "Continue anyway" hides it.
export function MobileBanner({ publicUrl }: { publicUrl: string }) {
  const t = useTranslations("app.pageBuilder.editor.mobileBanner");
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="border border-border bg-card p-4 lg:hidden">
      <div className="flex flex-col gap-2">
        <p className="text-sm font-semibold">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("body")}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<a href={publicUrl} target="_blank" rel="noreferrer" />}
          >
            {t("openPreview")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setDismissed(true)}>
            {t("continue")}
          </Button>
        </div>
      </div>
    </div>
  );
}
