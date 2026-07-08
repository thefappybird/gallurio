"use client";

import { useEffect, useRef, useState } from "react";

const RETRY_DELAYS_MS = [1000, 2000, 3000];

/**
 * Retries a broken image load with backoff before giving up.
 *
 * Cloudflare Images' flexible-variant delivery URL can transiently 404 for a
 * few seconds right after an upload finishes propagating — a user who
 * refreshes in that window would otherwise see a permanently broken image.
 * This retries the same `src` (cache-busted so the browser re-fetches) up to
 * `RETRY_DELAYS_MS.length` times before flagging `failed`.
 *
 * @param src The image URL to load; resets retry state whenever it changes.
 */
export function useImageRetry(src: string | undefined | null) {
  const [prevSrc, setPrevSrc] = useState(src);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjust state during render when `src` changes, rather than in an effect —
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  if (src !== prevSrc) {
    setPrevSrc(src);
    setAttempt(0);
    setFailed(false);
  }

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [src]);

  function handleError() {
    if (attempt < RETRY_DELAYS_MS.length) {
      timeoutRef.current = setTimeout(() => {
        setAttempt((a) => a + 1);
      }, RETRY_DELAYS_MS[attempt]);
    } else {
      setFailed(true);
    }
  }

  const resolvedSrc =
    src && attempt > 0 ? `${src}${src.includes("?") ? "&" : "?"}retry=${attempt}` : (src ?? undefined);

  return { src: resolvedSrc, failed, onError: handleError };
}
