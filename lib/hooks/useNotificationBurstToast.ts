import { useEffect, useRef, useState } from "react";

const BUNDLE_WINDOW_MS = 5000;
const TOAST_DISPLAY_MS = 3000;

/**
 * Bundles real-time notification arrivals into a single toast.
 *
 * `liveArrivalTick` must be a counter that increments ONLY on live socket
 * arrivals (never on initial/mount-time fetches) — see
 * NotificationProvider's `liveArrivalTick`. On the first arrival of a burst
 * a single 5s timer is armed; further arrivals within that window bump the
 * pending count but do NOT reset or extend the timer. When the timer fires,
 * the toast shows the bundled count and auto-hides after `TOAST_DISPLAY_MS`.
 */
export function useNotificationBurstToast(liveArrivalTick: number) {
  const [showToast, setShowToast] = useState(false);
  const [count, setCount] = useState(0);
  const burstCountRef = useRef(0);
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTickRef = useRef(liveArrivalTick);

  useEffect(() => {
    if (liveArrivalTick === prevTickRef.current) return;
    prevTickRef.current = liveArrivalTick;

    burstCountRef.current += 1;
    if (burstTimerRef.current !== null) return;

    burstTimerRef.current = setTimeout(() => {
      setCount(burstCountRef.current);
      setShowToast(true);
      burstCountRef.current = 0;
      burstTimerRef.current = null;

      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = setTimeout(() => {
        setShowToast(false);
        hideTimerRef.current = null;
      }, TOAST_DISPLAY_MS);
    }, BUNDLE_WINDOW_MS);
  }, [liveArrivalTick]);

  useEffect(() => {
    return () => {
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return { showToast, count };
}
