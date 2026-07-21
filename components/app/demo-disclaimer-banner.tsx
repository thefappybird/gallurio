"use client";

import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";

// Non-dismissible — the demo editor's localStorage-only persistence must stay
// visible for the whole session, unlike BetaEndingBanner which can be closed.
export function DemoDisclaimerBanner() {
  const t = useTranslations("app.portfolioMakerDemo.disclaimerBanner");

  return (
    <section
      className="sticky top-0 z-50 flex shrink-0 items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm text-foreground"
      role="status"
    >
      <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
      <p>{t("message")}</p>
    </section>
  );
}
