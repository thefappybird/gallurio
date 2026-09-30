"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const AppWorkspaceIdContext = createContext<string | null>(null);

/**
 * Workspace every app query key must be scoped by (see lib/query/keys.ts).
 * Throws outside `AppQueryProvider` so a missing mount fails loudly.
 */
export function useAppWorkspaceId(): string {
  const workspaceId = useContext(AppWorkspaceIdContext);
  if (workspaceId === null) {
    throw new Error("useAppWorkspaceId must be used within an AppQueryProvider");
  }
  return workspaceId;
}

/**
 * ONE React Query client for the authenticated app shell. Mount with
 * `key={workspaceId}` so a workspace switch remounts and drops the cache.
 */
export function AppQueryProvider({
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
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppWorkspaceIdContext.Provider value={workspaceId}>{children}</AppWorkspaceIdContext.Provider>
    </QueryClientProvider>
  );
}
