"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Status → presentation. `new` is the attention-grabbing default (primary
// pole); `converted` uses the brand accent so a won lead pops; the rest sit on
// the neutral scale so the eye rests on actionable rows.
const STATUS_CLASS: Record<string, string> = {
  converted: "border-transparent bg-brand text-brand-foreground",
  archived: "text-muted-foreground",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  new: "default",
  contacted: "secondary",
  archived: "outline",
};

export function InquiryStatusBadge({ status }: { status: string }) {
  const t = useTranslations("app.inquiries.statusValues");
  const labelKey = status === "converted" ? "booked" : status;
  const label = (() => {
    try {
      return t(labelKey);
    } catch {
      return labelKey;
    }
  })();

  return (
    <Badge
      variant={STATUS_VARIANT[status] ?? "outline"}
      className={cn("font-normal", STATUS_CLASS[status])}
    >
      {label}
    </Badge>
  );
}
