"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const GalleryWorkspaceIdContext = createContext<string | null>(null);

/**
 * Reads the workspaceId every gallery-picker query key must scope by. Throws
 * outside a `GalleryQueryProvider` so a missing mount fails loudly instead of
 * silently sharing cache entries across tenants.
 */
export function useGalleryWorkspaceId(): string {
  const workspaceId = useContext(GalleryWorkspaceIdContext);
  if (workspaceId === null) {
    throw new Error("useGalleryWorkspaceId must be used within a GalleryQueryProvider");
  }
  return workspaceId;
}

/**
 * Mounts ONE React Query client for the editor's gallery-picker fetches
 * (picker overview + per-collection feeds) and threads the active
 * `workspaceId` through context so every query key can be scoped by it —
 * required so a workspace switch never serves another tenant's cached data.
 */
export function GalleryQueryProvider({
  workspaceId,
  children,
}: {
  workspaceId: string;
  children: ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <GalleryWorkspaceIdContext.Provider value={workspaceId}>
        {children}
      </GalleryWorkspaceIdContext.Provider>
    </QueryClientProvider>
  );
}
