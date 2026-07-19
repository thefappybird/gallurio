"use client";

import { useEffect } from "react";

/**
 * Single document-level click delegate that opens the contact modal when any
 * element marked `data-cta="contact"` is activated. Server-rendered blocks
 * (HeroBlock, CTABannerBlock, ContactCardBlock) emit such buttons without
 * needing to hydrate — this one listener handles all of them.
 *
 * Mounted once in the public portfolio layout.
 */
export default function ContactTriggerDelegate() {
  useEffect(() => {
    function handler(e: MouseEvent) {
      const target = (e.target as HTMLElement | null)?.closest?.('[data-cta="contact"]');
      if (target) {
        e.preventDefault();
        window.__gallurioOpenContact?.();
      }
    }
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return null;
}
