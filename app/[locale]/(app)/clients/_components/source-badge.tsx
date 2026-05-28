"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Each client source gets a distinct, stable pill color drawn from the curated
// design tokens (brand teal shades + neutral poles — no raw colors). Text colors
// are chosen to contrast in both light and dark themes; fills stay subtle so the
// accent pops without dominating the view.
const SOURCE_BADGE_CLASS: Record<string, string> = {
  form: "border-brand bg-brand/10 text-brand",
  referral: "border-brand-2 bg-brand-2/10 text-brand-2",
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
