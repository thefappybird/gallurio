"use client";

import { useContext, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { NotificationContext } from "@/components/notifications/NotificationProvider";

/**
 * Soft-refreshes the current route when a live notification for one of the
 * given entity types arrives (any tab, including the actor's own — see
 * NotificationProvider's lastEntityEvent). Skips the initial mount so
 * mounting the hook doesn't trigger a spurious refresh.
 */
export function useLiveRefresh(entityTypes: string[], skip = false) {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useLiveRefresh must be used within NotificationProvider");
  const { lastEntityEvent } = ctx;
  const router = useRouter();
  const isFirstRender = useRef(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!lastEntityEvent || skip) return;
    if (!entityTypes.includes(lastEntityEvent.entityType)) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.refresh();
    }, 300);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only re-run on new entity events
  }, [lastEntityEvent?.tick]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);
}
