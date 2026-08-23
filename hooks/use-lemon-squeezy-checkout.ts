"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    createLemonSqueezy?: () => void;
    LemonSqueezy?: {
      Setup: (opts: { eventHandler: (data: { event: string; data?: unknown }) => void }) => void;
      Url: { Open: (url: string) => void; Close?: () => void };
    };
  }
}

// Loads Lemon Squeezy's checkout overlay script once per mount and wires its
// Checkout.Success event to the given callback. Returns `open(url)` for
// callers to trigger the overlay; it returns false (instead of opening
// anything) when the script hasn't finished loading yet, so callers can
// surface their own "not ready" message.
export function useLemonSqueezyCheckout(onCheckoutSuccess: () => void) {
  const [ready, setReady] = useState(false);
  const onSuccessRef = useRef(onCheckoutSuccess);

  // Keep the ref current without mutating it during render (React refs must
  // only be read/written in effects or event handlers).
  useEffect(() => {
    onSuccessRef.current = onCheckoutSuccess;
  });

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://app.lemonsqueezy.com/js/lemon.js";
    script.defer = true;
    script.onload = () => {
      window.createLemonSqueezy?.();
      window.LemonSqueezy?.Setup({
        eventHandler(e) {
          if (e.event === "Checkout.Success") onSuccessRef.current();
        },
      });
      setReady(true);
    };
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  function open(url: string): boolean {
    if (!ready || !window.LemonSqueezy) return false;
    window.LemonSqueezy.Url.Open(url);
    return true;
  }

  return { ready, open };
}
