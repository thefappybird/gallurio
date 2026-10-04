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
  const routerRef = useRef(router);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);

  useEffect(() => {
    // Decide at popstate time (location is already the destination) so the
    // refresh starts before the stale cached page finishes committing.
    // Same-path popstates (modal ?detail toggles) are not route changes.
    const onPop = () => {
      const dest = window.location.pathname;
      if (dest === lastPath.current) return;
      lastPath.current = dest;
      if (!consumeDirtyFor(dest)) return;
      // Let Next's own popstate handler dispatch its restore first.
      setTimeout(() => routerRef.current.refresh(), 0);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    lastPath.current = window.location.pathname;
  }, [pathname]);

  return null;
}
