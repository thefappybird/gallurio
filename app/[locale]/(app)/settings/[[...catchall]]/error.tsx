"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button, buttonVariants } from "@/components/ui/button";
import { Link } from "@/lib/i18n/navigation";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("app.settings.errorBoundary");

  useEffect(() => {
    console.error("[settings-error-boundary]", error);
  }, [error]);

  return (
    <main className="flex min-h-svh flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        <div className="flex items-center gap-3">
          <Button variant="brand" onClick={reset}>
            {t("retry")}
          </Button>
          <Link href="/settings" className={buttonVariants({ variant: "outline" })}>
            {t("reload")}
          </Link>
        </div>
      </div>
    </main>
  );
}
