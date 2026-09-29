"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Optional control rendered before Previous/Next (e.g. a page-size select). */
  children?: ReactNode;
  className?: string;
  labelClassName?: string;
  actionsClassName?: string;
  buttonClassName?: string;
};

/**
 * Shared "Showing X-Y of Z" + Previous/Next control. Callers own their own
 * pagination math (page/totalPages/from/to may come from a server total or a
 * client-filtered array length) and pass it in already computed.
 */
export function Pagination({
  page,
  totalPages,
  from,
  to,
  total,
  onPageChange,
  children,
  className = "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
  labelClassName = "text-sm text-muted-foreground",
  actionsClassName = "flex items-center gap-2 flex-wrap",
  buttonClassName = "min-h-11 sm:min-h-0",
}: PaginationProps) {
  const tc = useTranslations("common.pagination");

  return (
    <div className={className}>
      <span className={labelClassName}>{tc("showing", { from, to, total })}</span>
      <div className={actionsClassName}>
        {children}
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={buttonClassName}
        >
          {tc("previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={buttonClassName}
        >
          {tc("next")}
        </Button>
      </div>
    </div>
  );
}
