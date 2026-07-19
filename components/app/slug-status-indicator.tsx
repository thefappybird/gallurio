"use client";

import { Loader2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import type { SlugStatus } from "@/hooks/useSlugAvailability";

/**
 * Inline availability indicator for workspace slug inputs.
 *
 * Renders a single persistent live region so screen readers announce status
 * changes reliably. Text + icon — state is never communicated by color alone.
 */
export function SlugStatusIndicator({
  status,
  t,
}: {
  status: SlugStatus;
  t: ReturnType<typeof useTranslations>;
}) {
  let content: React.ReactNode = null;

  if (status === "checking") {
    content = (
      <>
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
        {t("slugChecking")}
      </>
    );
  } else if (status === "available") {
    content = (
      <>
        <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
        {t("slugAvailable")}
      </>
    );
  } else if (status === "taken" || status === "invalid") {
    content = (
      <>
        {status === "taken" ? (
          <XCircle className="h-3 w-3" aria-hidden="true" />
        ) : (
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
        )}
        {status === "taken" ? t("slugTaken") : t("slugInvalid")}
      </>
    );
  }

  const colorClass =
    status === "available"
      ? "text-[var(--success)]"
      : status === "taken" || status === "invalid"
        ? "text-destructive"
        : "text-muted-foreground";

  return (
    <p
      aria-live="polite"
      aria-atomic="true"
      className={`flex min-h-4 items-center gap-1 text-xs ${content ? colorClass : ""}`}
    >
      {content}
    </p>
  );
}
