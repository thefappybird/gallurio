"use client";

import { useState, useEffect, useRef } from "react";
import { checkSlugAvailabilityAction } from "@/lib/actions/slug";

export type SlugStatus = "idle" | "checking" | "available" | "taken" | "invalid";

/**
 * Debounced slug availability hook.
 *
 * @param slug        Current slug value from the input.
 * @param currentSlug The workspace already-saved slug (settings path).
 *                    When slug === currentSlug the check is skipped and
 *                    status stays "idle" so the indicator does not fire on
 *                    the initial form render.
 * @param checkCurrentSlug Set for first-time publishing, where the workspace's
 *                         provisional slug must still be checked before it can
 *                         become publicly reachable.
 */
export function useSlugAvailability(
  slug: string,
  currentSlug?: string,
  checkCurrentSlug = false,
): { status: SlugStatus } {
  const [status, setStatus] = useState<SlugStatus>("idle");
  // Monotonically-increasing request counter used to ignore stale responses.
  const seqRef = useRef(0);

  useEffect(() => {
    const skip = !slug || (!checkCurrentSlug && slug === currentSlug);
    const id = seqRef.current + 1;
    seqRef.current = id;

    const timer = setTimeout(async () => {
      if (skip) {
        setStatus("idle");
        return;
      }
      setStatus("checking");
      try {
        const result = await checkSlugAvailabilityAction(slug);
        // Ignore stale responses (another slug was typed after this request fired)
        if (seqRef.current !== id) return;
        if (result.available) {
          setStatus("available");
        } else if (result.reason === "invalid") {
          setStatus("invalid");
        } else {
          setStatus("taken");
        }
      } catch {
        if (seqRef.current !== id) return;
        setStatus("idle");
      }
    }, skip ? 0 : 400);

    return () => clearTimeout(timer);
  }, [slug, currentSlug, checkCurrentSlug]);

  return { status };
}
