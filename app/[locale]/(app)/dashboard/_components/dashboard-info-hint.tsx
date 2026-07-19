"use client";

import { useTranslations } from "next-intl";
import { InfoHint } from "@/components/ui/info-hint";

// Thin client wrapper so server card components can drop an info affordance in
// their header by key, without threading the resolved string through props.
export function DashboardInfoHint({ hint }: { hint: string }) {
  const t = useTranslations("app.dashboard.hints");
  return <InfoHint label={t(hint)} />;
}
