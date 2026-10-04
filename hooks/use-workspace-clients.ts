"use client";

import { useQuery } from "@tanstack/react-query";
import { useAppWorkspaceId } from "@/components/app/app-query-provider";
import { REFERENCE_STALE_TIME, queryKeys } from "@/lib/query/keys";

export type WorkspaceClient = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

/**
 * Lean client list for pickers, fetched lazily (only once `enabled`) and cached
 * as reference data. Invalidated by any client.* / booking.* event.
 */
export function useWorkspaceClients({ enabled }: { enabled: boolean }) {
  const ws = useAppWorkspaceId();
  return useQuery({
    queryKey: queryKeys(ws).clients("picker"),
    queryFn: async (): Promise<WorkspaceClient[]> => {
      const res = await fetch("/api/clients?limit=1000");
      if (!res.ok) throw new Error(`clients_load_failed_${res.status}`);
      return res.json();
    },
    staleTime: REFERENCE_STALE_TIME,
    enabled,
  });
}
