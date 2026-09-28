"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Renders inside the editor's Preview iframe. Chrome-less on purpose -- no
 * nav, no links -- since this iframe has no app shell of its own.
 */
export default function PortfolioPreviewError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("app.pageBuilder.previewError");

  useEffect(() => {
    console.error("[portfolio-preview-error-boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <p className="text-sm text-muted-foreground">{t("title")}</p>
      <Button variant="outline" onClick={reset}>
        {t("retry")}
      </Button>
    </main>
  );
}
