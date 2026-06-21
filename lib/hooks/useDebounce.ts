import { useCallback, useEffect, useRef } from 'react';

export type DebouncedFn<T> = {
  debounced: (value: T) => void;
  flush: () => void;
};

export function useDebounce<T>(
  callback: (value: T) => void,
  delay = 120,
): DebouncedFn<T> {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<T | undefined>(undefined);
  const hasPendingRef = useRef(false);
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  const flush = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (hasPendingRef.current) {
      hasPendingRef.current = false;
      callbackRef.current(pendingRef.current as T);
    }
  }, []);

  const debounced = useCallback(
    (value: T) => {
      pendingRef.current = value;
      hasPendingRef.current = true;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        if (hasPendingRef.current) {
          hasPendingRef.current = false;
          callbackRef.current(pendingRef.current as T);
        }
      }, delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  return { debounced, flush };
}
