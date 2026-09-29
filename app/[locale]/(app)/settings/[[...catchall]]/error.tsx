"use client";

import { useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/lib/i18n/navigation";

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("app.settings.errorBoundary");
  const router = useRouter();
  const [, startTransition] = useTransition();

  useEffect(() => {
    console.error("[settings-error-boundary]", error);
  }, [error]);

  function reload() {
    // A pathname-only Link reset does nothing if the crash happened on
    // /settings itself (no slug, the default/most-visited tab) since Next
    // only resets an error boundary on a pathname change. Force a real
    // server re-render instead, regardless of the current pathname.
    startTransition(() => {
      router.refresh();
      reset();
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-background px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
        <div className="flex items-center gap-3">
          <Button variant="brand" onClick={reset}>
            {t("retry")}
          </Button>
          <Button variant="outline" onClick={reload}>
            {t("reload")}
          </Button>
        </div>
      </div>
    </div>
  );
}
