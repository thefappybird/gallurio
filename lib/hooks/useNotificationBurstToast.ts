import { useEffect, useRef, useState } from "react";

const TOAST_DISPLAY_MS = 1500;

/**
 * Shows a compact arrival cue at the same time as the bell nudge. Arrivals
 * received while it is visible increment the count and restart its dismissal.
 *
 * `liveArrivalTick` must be a counter that increments ONLY on live socket
 * arrivals (never on initial/mount-time fetches) — see
 * NotificationProvider's `liveArrivalTick`. On the first arrival of a burst
 * every arrival updates the visible count immediately and auto-hides after
 * `TOAST_DISPLAY_MS` of inactivity.
 */
export function useNotificationBurstToast(liveArrivalTick: number) {
  const [showToast, setShowToast] = useState(false);
  const [count, setCount] = useState(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTickRef = useRef(liveArrivalTick);

  useEffect(() => {
    if (liveArrivalTick === prevTickRef.current) return;
    prevTickRef.current = liveArrivalTick;

    setCount((count) => count + 1);
    setShowToast(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowToast(false);
      setCount(0);
      hideTimerRef.current = null;
    }, TOAST_DISPLAY_MS);
  }, [liveArrivalTick]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  return { showToast, count };
}
