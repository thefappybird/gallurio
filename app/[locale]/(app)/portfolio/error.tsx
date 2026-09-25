"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

/**
 * Catches a Puck editor crash on /portfolio. The editor's autosave writes the
 * current draft to localStorage on every change (see the portfolio-drafts
 * skill), so a render crash does not lose it -- reload the editor or reopen
 * it via the Drafts dialog to pick the draft back up.
 */
export default function PortfolioError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("app.pageBuilder.errorBoundary");

  useEffect(() => {
    console.error("[portfolio-error-boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("draftSafe")}</p>
        <div className="flex items-center gap-3">
          <Button variant="brand" onClick={reset}>
            {t("retry")}
          </Button>
          <Link href="/portfolio" className={buttonVariants({ variant: "outline" })}>
            {t("reload")}
          </Link>
        </div>
      </div>
    </main>
  );
}
