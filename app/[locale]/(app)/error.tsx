"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();

  useEffect(() => {
    console.error("[app-error-boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <p className="text-sm text-muted-foreground">{t("app.errors.generic")}</p>
        <div className="flex items-center gap-3">
          <Button variant="brand" onClick={reset}>
            {t("app.errorBoundary.retry")}
          </Button>
          <Link href="/dashboard" className={buttonVariants({ variant: "outline" })}>
            {t("notFound.backToDashboard")}
          </Link>
        </div>
      </div>
    </main>
  );
}
