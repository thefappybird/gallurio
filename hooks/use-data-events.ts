"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { DataEvent } from "@/lib/data-events";
import { routing } from "@/lib/i18n/routing";
import { invalidateFor, markLocalEvent, routesForEvent } from "@/lib/query/invalidation";
import { useAppWorkspaceId } from "@/components/app/app-query-provider";

const REFRESH_DEBOUNCE_MS = 250;

// Module-level so every caller (mutation sites + socket) coalesces into one refresh.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(refresh: () => void) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refresh();
  }, REFRESH_DEBOUNCE_MS);
}

/** Drop a leading locale segment (`/fil/bookings` -> `/bookings`). Default locale has no prefix. */
export function stripLocale(pathname: string): string {
  const [, first, ...rest] = pathname.split("/");
  if (first && (routing.locales as readonly string[]).includes(first)) return "/" + rest.join("/");
  return pathname;
}

function pathMatches(pathname: string, routes: string[]): boolean {
  const path = stripLocale(pathname);
  return routes.some((r) => r === "/" || path === r || path.startsWith(r + "/"));
}

/**
 * Invalidate client queries for `event` and, when the current page's
 * server-rendered data is affected, debounced `router.refresh()`. Does NOT mark
 * the event local — the socket path uses this after its own echo check.
 */
export function useApplyDataEvent(): (event: DataEvent) => void {
  const queryClient = useQueryClient();
  const workspaceId = useAppWorkspaceId();
  const router = useRouter();
  const pathname = usePathname();

  return useCallback(
    (event: DataEvent) => {
      void invalidateFor(queryClient, workspaceId, event);
      if (pathMatches(pathname ?? "", routesForEvent(event))) scheduleRefresh(() => router.refresh());
    },
    [queryClient, workspaceId, router, pathname],
  );
}

/** For mutation sites: mark local (suppresses the socket echo), then apply. */
export function useInvalidateFor(): (event: DataEvent) => void {
  const apply = useApplyDataEvent();
  return useCallback(
    (event: DataEvent) => {
      markLocalEvent(event);
      apply(event);
    },
    [apply],
  );
}
