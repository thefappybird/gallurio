"use client";

import { useEffect, useRef, useCallback, useImperativeHandle } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "compact";
        },
      ) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
    onTurnstileLoad?: () => void;
  }
}

export interface TurnstileWidgetHandle {
  /** Discards the current (possibly already-consumed) token and asks
   *  Cloudflare for a fresh one. Call after any failed form submission --
   *  Turnstile tokens are single-use, so a retry with the same token would
   *  fail bot verification even with correct credentials. */
  reset: () => void;
}

interface TurnstileWidgetProps {
  ref?: React.Ref<TurnstileWidgetHandle>;
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
}

const IS_DEV = process.env.NODE_ENV === "development";

/**
 * Cloudflare Turnstile widget (explicit render mode, no npm dep).
 * Loads the Turnstile script once and renders the widget into the container.
 * The token is surfaced via onToken -- the parent must inject it into the form
 * as a hidden field named "cf-turnstile-response" before submit.
 *
 * In local development (NODE_ENV === "development") the widget is skipped
 * entirely: onToken is called once on mount with a sentinel "dev-bypass" value
 * so forms are immediately submittable without a real Cloudflare challenge.
 */
export function TurnstileWidget({
  ref,
  onToken,
  onExpire,
  onError,
  className,
}: TurnstileWidgetProps) {
  // Capture onToken in a ref so the dev-bypass effect can call it without
  // adding it to the dependency array. The ref is initialized once on mount;
  // since the effect also runs once on mount, the value is always current.
  const onTokenRef = useRef(onToken);

  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const renderRef = useRef<(() => void) | null>(null);

  // Dev-only mount effect: fire sentinel token so parent forms become enabled.
  // Gated on IS_DEV (module-level constant) -- not "!== production" -- so that
  // NODE_ENV="test" (Vitest) still exercises the real fail-closed server path.
  useEffect(() => {
    if (!IS_DEV) return;
    onTokenRef.current("dev-bypass");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const siteKey = IS_DEV ? "" : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "");

  useImperativeHandle(ref, () => ({
    reset: () => {
      if (IS_DEV) {
        // No real widget in dev -- just re-fire the sentinel so the caller's
        // token state clears and immediately re-enables the submit button.
        onTokenRef.current("dev-bypass");
        return;
      }
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.reset(widgetIdRef.current);
      }
    },
  }), []);

  const render = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !siteKey) return;
    if (widgetIdRef.current) return;

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => {
        onExpire?.();
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
          widgetIdRef.current = null;
          setTimeout(() => renderRef.current?.(), 50);
        }
      },
      "error-callback": () => {
        onError?.();
      },
    });
  }, [onToken, onExpire, onError, siteKey]);

  useEffect(() => {
    if (IS_DEV || !siteKey) return;
    renderRef.current = render;

    if (window.turnstile) {
      render();
      return;
    }

    window.onTurnstileLoad = render;

    const existing = document.querySelector(
      'script[src*="challenges.cloudflare.com/turnstile"]',
    );
    if (!existing) {
      const script = document.createElement("script");
      script.src =
        "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit";
      script.async = true;
      document.head.appendChild(script);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [render, siteKey]);

  // In development: render nothing -- the sentinel token was already fired above.
  if (IS_DEV) return null;

  if (!siteKey) return null;

  return <div ref={containerRef} className={className} />;
}
