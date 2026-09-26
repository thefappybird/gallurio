"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { PickerData } from "./types";
import { galleryKeys } from "./queryKeys";
import { useGalleryWorkspaceId } from "./GalleryQueryProvider";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: PickerData };

async function fetchPickerData(): Promise<PickerData> {
  const res = await fetch("/api/portfolio/gallery");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as PickerData;
}

/**
 * Invalidates the current workspace's picker-data query so every mounted
 * `usePickerData()` consumer re-fetches — not just the caller. Call this from
 * ANY create/upload site (inside the picker or elsewhere) after a mutation
 * that changes collections or items.
 */
export function useInvalidatePickerData(): () => void {
  const workspaceId = useGalleryWorkspaceId();
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: galleryKeys.picker(workspaceId) });
  };
}

/**
 * Fetches picker data (collections + items) from the portfolio gallery API,
 * scoped by the active `workspaceId` (from `GalleryQueryProvider`) so a
 * workspace switch never serves another tenant's cached collections. Backed
 * by React Query: concurrent mounts share one in-flight request, and results
 * are cached for the query's `staleTime`. Calling `retry()` invalidates the
 * cache and re-fetches in every mounted instance — use it after uploads or
 * collection creates.
 */
export function usePickerData(): { state: State; retry: () => void } {
  const workspaceId = useGalleryWorkspaceId();
  const invalidate = useInvalidatePickerData();
  const query = useQuery({
    queryKey: galleryKeys.picker(workspaceId),
    queryFn: fetchPickerData,
  });

  const state: State = query.isError
    ? { status: "error", message: String(query.error) }
    : query.data
      ? { status: "ok", data: query.data }
      : { status: "loading" };

  return { state, retry: invalidate };
}
