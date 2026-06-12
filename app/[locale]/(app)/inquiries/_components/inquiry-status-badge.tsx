"use client";

import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getInquiryStatusLabelKey, isBookedInquiryStatus } from "@/lib/inquiries/status";

const STATUS_CLASS: Record<string, string> = {
  booked: "border-transparent bg-brand text-brand-foreground",
  archived: "text-muted-foreground",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  new: "default",
  contacted: "secondary",
  archived: "outline",
};

export function InquiryStatusBadge({ status }: { status: string }) {
  const t = useTranslations("app.inquiries.statusValues");
  const normalizedStatus = isBookedInquiryStatus(status) ? "booked" : status;
  const labelKey = getInquiryStatusLabelKey(status);
  const label = (() => {
    try {
      return t(labelKey);
    } catch {
      return labelKey;
    }
  })();

  return (
    <Badge
      variant={STATUS_VARIANT[normalizedStatus] ?? "outline"}
      className={cn("font-normal", STATUS_CLASS[normalizedStatus])}
    >
      {label}
    </Badge>
  );
}
