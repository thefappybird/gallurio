"use client";

import { CheckIcon } from "lucide-react";
import { useTranslations } from "next-intl";

/**
 * Brand pane shown alongside every auth form. Static across routes (matches
 * the landing page's tagline + trust strip, not a per-page ledger message) so
 * sign-in/sign-up/mfa/etc. all read as one consistent brand moment. The
 * shared `<AmbientBackground />` rendered by the parent layout shows through
 * (this pane has no opaque background of its own), so the flowing line-art
 * lives directly behind the text.
 */
export function AuthBrandPane() {
  const t = useTranslations("auth.brandPane");
  const tTrust = useTranslations("marketing.trust");

  const trustItems = [tTrust("item1"), tTrust("item2"), tTrust("item3"), tTrust("item4")];

  return (
    <div className="relative flex flex-1 flex-col justify-end gap-6 md:flex">
      <div className="hidden md:block">
        <span className="mb-4 inline-flex items-center rounded-[var(--radius-sm)] bg-brand px-3 py-1 text-[0.68rem] font-bold tracking-wider text-brand-foreground uppercase">
          {t("eyebrow")}
        </span>
        <h2 className="max-w-xs text-balance font-heading text-2xl font-bold tracking-tight text-foreground">
          {t("headline")}
        </h2>
      </div>
      <ul className="flex flex-col gap-2">
        {trustItems.map((item) => (
          <li key={item} className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <CheckIcon className="size-4 shrink-0 text-brand" aria-hidden />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
