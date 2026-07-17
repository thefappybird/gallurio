"use client";

import { useState, useSyncExternalStore } from "react";
import { InfoIcon, XIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { BETA_TWO_MONTH_PROMO_CODE } from "@/lib/billing/betaPromo";

const DISMISS_KEY_PREFIX = "gw_beta_ending_banner_dismissed:";

export function BetaEndingBanner({ scheduledEndAt }: { scheduledEndAt: string }) {
  const t = useTranslations("app.betaEndingBanner");
  const storageKey = `${DISMISS_KEY_PREFIX}${scheduledEndAt}`;
  const [dismissedThisRender, setDismissedThisRender] = useState(false);
  const wasDismissedThisSession = useSyncExternalStore(
    () => () => {},
    () => window.sessionStorage.getItem(storageKey) === "true",
    () => false
  );
  const dismissed = dismissedThisRender || wasDismissedThisSession;

  if (dismissed) return null;

  return (
    <section className="flex items-start gap-3 border-b border-border bg-muted px-4 py-3 text-sm text-foreground" role="status">
      <InfoIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("title")}</p>
        <p className="mt-0.5 text-muted-foreground">
          {t.rich("message", {
            code: BETA_TWO_MONTH_PROMO_CODE,
            promoCode: (chunks) => <strong className="font-semibold text-foreground">{chunks}</strong>,
          })}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          window.sessionStorage.setItem(storageKey, "true");
          setDismissedThisRender(true);
        }}
        className="shrink-0 border border-border p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("dismiss")}
      >
        <XIcon className="size-4" aria-hidden="true" />
      </button>
    </section>
  );
}
