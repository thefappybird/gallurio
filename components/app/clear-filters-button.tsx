"use client";

import { useTransition } from "react";
import { useRouter, usePathname } from "@/lib/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  paramKeys: string[];
  defaultValues?: Record<string, string>;
};

export function ClearFiltersButton({ paramKeys, defaultValues = {} }: Props) {
  const t = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const hasActiveFilter = paramKeys.some((key) => {
    const value = searchParams.get(key);
    const defaultValue = defaultValues[key] ?? null;
    return value !== null && value !== defaultValue;
  });

  if (!hasActiveFilter) return null;

  function handleClear() {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of paramKeys) {
      params.delete(key);
    }
    params.set("page", "1");
    const qs = params.toString();
    startTransition(() => {
      router.push(qs ? `${pathname}?${qs}` : pathname);
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClear}>
      <XIcon className="size-4" />
      {t("clearFilters")}
    </Button>
  );
}
