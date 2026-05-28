"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { PAGE_SIZE_OPTIONS } from "@/lib/pagination";

type Props = {
  value: number;
  paramName?: string;
  options?: number[];
  className?: string;
};

export function PageSizeSelect({
  value,
  paramName = "limit",
  options = PAGE_SIZE_OPTIONS,
  className,
}: Props) {
  // TEMP-DEBUG
  console.count("render: PageSizeSelect");
  const t = useTranslations("common.pagination");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  function handleChange(newValue: string | null) {
    if (!newValue) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set(paramName, newValue);
    sp.set("page", "1");
    startTransition(() => {
      router.push(`${pathname}?${sp.toString()}`);
    });
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-sm text-muted-foreground whitespace-nowrap">{t("rowsPerPage")}</span>
      <Select<string> value={String(value)} onValueChange={handleChange}>
        <SelectTrigger className="h-8 w-18 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt} value={String(opt)}>
              {opt}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
