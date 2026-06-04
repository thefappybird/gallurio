"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickerData } from "./types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: PickerData };

// Module-level cache — survives component unmount/remount within the same page
// session so re-fetching doesn't happen every time a different block is selected
// and a new picker instance mounts. Cleared on page reload or explicit retry().
let pickerDataCache: PickerData | null = null;
// In-flight promise — de-dupes concurrent mounts that both see cache === null,
// so only ONE network request fires per page session.
let pickerDataPromise: Promise<PickerData> | null = null;

// Shared fetch: returns the cached data, the in-flight promise, or starts a new
// request. Bookkeeping handlers (attached here) observe both outcomes so the
// shared promise is never left as an unhandled rejection.
function fetchPickerData(): Promise<PickerData> {
  if (pickerDataCache) return Promise.resolve(pickerDataCache);
  if (pickerDataPromise) return pickerDataPromise;

  const p = fetch("/api/portfolio/gallery").then(async (res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as PickerData;
  });
  pickerDataPromise = p;
  p.then(
    (data) => {
      pickerDataCache = data;
      pickerDataPromise = null;
    },
    () => {
      pickerDataPromise = null;
    }
  );
  return p;
}

/**
 * Fetches picker data (collections + items) from the portfolio gallery API.
 * Results are cached module-level so the network request only fires once per
 * page session, with concurrent mounts sharing a single in-flight request.
 * Calling `retry()` invalidates the cache and re-fetches — use it after uploads
 * or collection creates.
 */
export function usePickerData() {
  // Initial state reflects the cache synchronously; otherwise "loading". The
  // effect only SUBSCRIBES (async setState on settle) — it never calls setState
  // synchronously, so no cascading-render lint warning.
  const [state, setState] = useState<State>(
    pickerDataCache ? { status: "ok", data: pickerDataCache } : { status: "loading" }
  );
  const mountedRef = useRef(true);

  const subscribe = useCallback(() => {
    fetchPickerData().then(
      (data) => {
        if (mountedRef.current) setState({ status: "ok", data });
      },
      (err) => {
        if (mountedRef.current) setState({ status: "error", message: String(err) });
      }
    );
  }, []);

  // Event-handler retry explicitly busts the cache (called after uploads/creates).
  // setState("loading") is fine here — an event handler, not an effect body.
  const retry = useCallback(() => {
    pickerDataCache = null;
    pickerDataPromise = null;
    setState({ status: "loading" });
    subscribe();
  }, [subscribe]);

  useEffect(() => {
    mountedRef.current = true;
    subscribe();
    return () => {
      mountedRef.current = false;
    };
  }, [subscribe]);

  return { state, retry };
}

/** Test-only helper — resets the module-level cache between test runs. */
export function __clearPickerDataCache(): void {
  pickerDataCache = null;
  pickerDataPromise = null;
}
