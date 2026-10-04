"use client";

import { useEffect } from "react";
import { calculateTableSkeletonRows } from "@/components/app/table-skeleton";
import { useViewportRemainingHeight } from "@/hooks/use-viewport-remaining-height";
import {
  parseFitCookie,
  TABLE_FIT_COOKIE,
  type FitTable,
} from "@/lib/tables/page-fit";

/** Cookie string to write, or null when the stored value already matches. */
export function nextFitCookie(
  table: FitTable,
  rows: number,
  currentCookies: string
): string | null {
  const name = TABLE_FIT_COOKIE[table];
  const current = currentCookies
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!Number.isSafeInteger(rows) || rows <= 0) return null;
  if (parseFitCookie(current) === rows) return null;
  return `${name}=${rows}; SameSite=Lax; max-age=31536000; path=/`;
}

/**
 * Attach the returned ref to the real table's outer wrapper. On desktop it
 * records how many rows fit the viewport in a cookie so the server can size
 * the next navigation's page. No refresh: the new value applies next load.
 */
export function useTableFitCookie<T extends HTMLElement>(
  table: FitTable,
  rowHeight: number,
  headerHeight = 32
) {
  const { ref, remainingHeight } = useViewportRemainingHeight<T>();

  useEffect(() => {
    if (remainingHeight === null) return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    const node = ref.current;
    // Scrolled page or empty table (no pagination sibling) overstates the fit.
    if (!node || node.getBoundingClientRect().top < 0) return;
    if (!node.querySelector("tbody tr")) return;
    const rows = calculateTableSkeletonRows({
      availableHeight: remainingHeight,
      headerHeight,
      rowHeight,
    });
    const cookie = nextFitCookie(table, rows, document.cookie);
    if (cookie) document.cookie = cookie;
  }, [ref, remainingHeight, table, rowHeight, headerHeight]);

  return ref;
}
