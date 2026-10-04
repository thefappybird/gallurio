"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { consumeDirtyFor } from "@/lib/query/dirty-routes";

/**
 * Back/forward reuses cached RSC payloads, which may predate a mutation made
 * elsewhere (see lib/query/dirty-routes.ts). When history lands on a route the
 * data-event layer marked dirty, refresh it once. Renders nothing.
 */
export function HistoryRefreshGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const lastPath = useRef(pathname);
  const fromHistory = useRef(false);

  useEffect(() => {
    // Same-path popstates (modal ?detail toggles) are not route changes.
    const onPop = () => {
      if (window.location.pathname !== lastPath.current) fromHistory.current = true;
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    lastPath.current = window.location.pathname;
    if (!fromHistory.current) return;
    fromHistory.current = false;
    if (consumeDirtyFor(pathname)) router.refresh();
  }, [pathname, router]);

  return null;
}
