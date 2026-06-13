"use client";

import { useEffect, useRef, useCallback } from "react";

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

interface TurnstileWidgetProps {
  onToken: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  className?: string;
}

/**
 * Cloudflare Turnstile widget (explicit render mode, no npm dep).
 * Loads the Turnstile script once and renders the widget into the container.
 * The token is surfaced via onToken — the parent must inject it into the form
 * as a hidden field named "cf-turnstile-response" before submit.
 */
export function TurnstileWidget({
  onToken,
  onExpire,
  onError,
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";
  // Stable ref to avoid circular dependency in the useCallback
  const renderRef = useRef<(() => void) | null>(null);

  const render = useCallback(() => {
    if (!containerRef.current || !window.turnstile || !siteKey) return;
    if (widgetIdRef.current) return; // Already rendered

    widgetIdRef.current = window.turnstile.render(containerRef.current, {
      sitekey: siteKey,
      callback: onToken,
      "expired-callback": () => {
        onExpire?.();
        // Reset so the user can get a fresh token
        if (widgetIdRef.current && window.turnstile) {
          window.turnstile.reset(widgetIdRef.current);
          widgetIdRef.current = null;
          // Re-render after reset via stable ref
          setTimeout(() => renderRef.current?.(), 50);
        }
      },
      "error-callback": () => {
        onError?.();
      },
    });
  }, [onToken, onExpire, onError, siteKey]);

  useEffect(() => {
    if (!siteKey) return;
    // Keep renderRef in sync so the expired-callback can call the latest render
    renderRef.current = render;

    if (window.turnstile) {
      render();
      return;
    }

    // Set global callback for when script loads
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

  if (!siteKey) return null;

  return <div ref={containerRef} className={className} />;
}
