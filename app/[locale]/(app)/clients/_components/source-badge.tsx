"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Each client source gets a perceptually distinct, stable pill color drawn from
// the curated design tokens (brand teal + neutral poles — no raw colors). The four
// are separated along three axes so they never read as the same color at badge
// size in either theme: fill vs. outline, hue (teal vs. neutral), and lightness.
//   form     — solid teal (the primary inbound/website source; uses its paired fg)
//   referral — teal outline (clearly hollow next to the solid form pill)
//   manual   — muted neutral
//   import   — strong neutral (foreground), distinct from the muted manual pill
const SOURCE_BADGE_CLASS: Record<string, string> = {
  form: "border-brand bg-brand text-brand-foreground",
  referral: "border-brand bg-brand/10 text-brand",
  manual: "border-muted-foreground/50 bg-muted/50 text-muted-foreground",
  import: "border-foreground/40 bg-foreground/[0.06] text-foreground",
};

type Props = {
  source: string;
  className?: string;
};

export function SourceBadge({ source, className }: Props) {
  const t = useTranslations("app.clients");
  return (
    <Badge
      variant="outline"
      className={cn("font-normal capitalize", SOURCE_BADGE_CLASS[source] ?? "", className)}
    >
      {t(`sourceValues.${source}` as Parameters<typeof t>[0])}
    </Badge>
  );
}
