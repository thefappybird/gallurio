"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import type { DataEvent } from "@/lib/data-events";
import { invalidateFor, markLocalEvent, routesForEvent } from "@/lib/query/invalidation";
import { clearDirtyRoutes, markRoutesDirty, pathMatches } from "@/lib/query/dirty-routes";
import { useAppWorkspaceId } from "@/components/app/app-query-provider";

const REFRESH_DEBOUNCE_MS = 250;

export interface InvalidateOptions {
  /** Schedule `router.refresh()` for affected routes. Default true. */
  refresh?: boolean;
}

// Module-level so every caller (mutation sites + socket) coalesces into one refresh.
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRefresh(refresh: () => void) {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = setTimeout(() => {
    refreshTimer = null;
    refresh();
  }, REFRESH_DEBOUNCE_MS);
}

/**
 * Invalidate client queries for `event` and, when the current page's
 * server-rendered data is affected, debounced `router.refresh()`. Does NOT mark
 * the event local — the socket path uses this after its own echo check.
 */
export function useApplyDataEvent(): (event: DataEvent, options?: InvalidateOptions) => void {
  const queryClient = useQueryClient();
  const workspaceId = useAppWorkspaceId();
  const router = useRouter();

  return useCallback(
    (event: DataEvent, { refresh = true }: InvalidateOptions = {}) => {
      void invalidateFor(queryClient, workspaceId, event);
      // Read at event time: always the current page, no stale closure.
      const routes = routesForEvent(event);
      const pathname = window.location.pathname;
      const refreshing = refresh && pathMatches(pathname, routes);
      // Back/forward reuses cached payloads: remember routes not refreshed now.
      markRoutesDirty(routes, pathname, refreshing);
      if (refreshing) {
        scheduleRefresh(() => {
          router.refresh();
          // refresh() stales the whole client router cache, so nothing is dirty after it.
          clearDirtyRoutes();
        });
      }
    },
    [queryClient, workspaceId, router],
  );
}

/**
 * For mutation sites: mark local (suppresses the socket echo), then apply.
 * Pass `{ refresh: false }` when the mutation's response already carries fresh RSC
 * (server action that `revalidatePath`s this route) or the UI applied the result locally.
 */
export function useInvalidateFor(): (event: DataEvent, options?: InvalidateOptions) => void {
  const apply = useApplyDataEvent();
  return useCallback(
    (event: DataEvent, options?: InvalidateOptions) => {
      markLocalEvent(event);
      apply(event, options);
    },
    [apply],
  );
}
