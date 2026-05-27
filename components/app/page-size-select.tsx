"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const DEFAULT_OPTIONS = [10, 20, 30, 50];

type Props = {
  value: number;
  paramName?: string;
  options?: number[];
  className?: string;
};

export function PageSizeSelect({
  value,
  paramName = "limit",
  options = DEFAULT_OPTIONS,
  className,
}: Props) {
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
      {/* TODO: add common.rowsPerPage i18n key */}
      <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
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
