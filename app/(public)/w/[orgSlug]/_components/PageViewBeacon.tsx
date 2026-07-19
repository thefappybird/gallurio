"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Fire-and-forget page-view beacon for the public portfolio. Sends one POST per
 * distinct path (StrictMode/re-render-safe via the ref guard). Failures are
 * ignored — tracking must never affect the visitor's experience. Contact is a
 * modal, not a route, so only Home/Gallery are reported here; the inquiry
 * counter is the contact-engagement signal.
 */
export function PageViewBeacon({ orgSlug }: { orgSlug: string }) {
  const pathname = usePathname();
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (firedFor.current === pathname) return;
    firedFor.current = pathname;

    const page = pathname.endsWith("/gallery") ? "gallery" : "home";
    const body = JSON.stringify({
      orgSlug,
      page,
      referrer: document.referrer || undefined,
    });
    // keepalive so the request survives a navigation away from the page.
    fetch("/api/public/pageviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  }, [pathname, orgSlug]);

  return null;
}
