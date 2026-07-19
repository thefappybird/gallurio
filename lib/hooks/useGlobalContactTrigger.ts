"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    /**
     * Set by the mounted <ContactModal />. Any portfolio CTA (server-rendered
     * `[data-cta="contact"]` buttons routed through ContactTriggerDelegate, or
     * the client PortfolioHeader button) calls this to open the contact modal.
     */
    __gallurioOpenContact?: () => void;
  }
}

/**
 * Registers a global opener so server-rendered blocks can open the single
 * mounted contact modal without each block hydrating. Cleans up on unmount and
 * only removes the handle if it still points at this opener (avoids clobbering
 * a remount that registered first).
 */
export function useGlobalContactTrigger(open: () => void) {
  useEffect(() => {
    window.__gallurioOpenContact = open;
    return () => {
      if (window.__gallurioOpenContact === open) {
        delete window.__gallurioOpenContact;
      }
    };
  }, [open]);
}
