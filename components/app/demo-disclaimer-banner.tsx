"use client";

import { useEffect, useState } from "react";
import { InfoIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { DEMO_PROMO_CODE, DEMO_PROMO_CLAIMED_EVENT, isDemoPromoClaimed } from "@/lib/page-builder/demoSession";

// Non-dismissible — the demo editor's localStorage-only persistence must stay
// visible for the whole session, unlike BetaEndingBanner which can be closed.
export function DemoDisclaimerBanner() {
  const t = useTranslations("app.portfolioMakerDemo.disclaimerBanner");
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional: syncs the localStorage promo-claimed flag (external store) into React state on mount; SSR/first-paint fallback is unclaimed
    setClaimed(isDemoPromoClaimed());
    const onClaim = () => setClaimed(true);
    window.addEventListener(DEMO_PROMO_CLAIMED_EVENT, onClaim);
    return () => window.removeEventListener(DEMO_PROMO_CLAIMED_EVENT, onClaim);
  }, []);

  return (
    <section
      className="sticky top-0 z-50 flex shrink-0 items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm text-foreground"
      role="status"
    >
      <InfoIcon className="size-4 shrink-0" aria-hidden="true" />
      <p>{t("message")}</p>
      {claimed && <p className="font-medium">{t("bonusCode", { code: DEMO_PROMO_CODE })}</p>}
    </section>
  );
}
