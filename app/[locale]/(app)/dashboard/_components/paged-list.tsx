"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

type Props = {
  /** Pre-rendered <li> items to page through. */
  items: ReactNode[];
  pageSize?: number;
};

/**
 * Client pager for dashboard lists: renders `pageSize` items at a time with
 * Previous/Next controls that only appear when there's more than one page.
 */
export function PagedList({ items, pageSize = 5 }: Props) {
  const t = useTranslations("app.dashboard.pagination");
  const [page, setPage] = useState(0);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount - 1);
  const start = current * pageSize;
  const slice = items.slice(start, start + pageSize);

  const btn =
    "rounded-[var(--radius)] px-2 py-1 font-medium text-brand outline-none transition-colors hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <>
      <ul className="flex flex-col divide-y divide-border">{slice}</ul>
      {pageCount > 1 && (
        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className={btn}
          >
            {t("prev")}
          </button>
          <span className="text-muted-foreground tabular-nums">
            {t("status", { page: current + 1, total: pageCount })}
          </span>
          <button
            type="button"
            disabled={current >= pageCount - 1}
            onClick={() => setPage(current + 1)}
            className={btn}
          >
            {t("next")}
          </button>
        </div>
      )}
    </>
  );
}
