"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickerData } from "./types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: PickerData };

// Module-level cache — survives component unmount/remount within the same page
// session so re-fetching doesn't happen every time a different block is selected
// and a new picker instance mounts. Cleared on page reload or explicit
// invalidatePickerData()/retry().
let pickerDataCache: PickerData | null = null;
// In-flight promise — de-dupes concurrent mounts that both see cache === null,
// so only ONE network request fires per page session.
let pickerDataPromise: Promise<PickerData> | null = null;
// Every currently-mounted usePickerData() instance registers a notify callback
// here so invalidatePickerData() can push a re-fetch to ALL of them, not just
// the caller. Without this, one component's retry() only ever refreshed its
// own local state — a create/upload in one picker instance left every other
// already-mounted instance (a different block's thumbnail lookup, another
// open picker) showing stale collections/items until a full page reload.
const listeners = new Set<() => void>();

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
 * Invalidates the shared picker-data cache and pushes a re-fetch to every
 * mounted `usePickerData()` consumer — not just the caller. Call this from
 * ANY create/upload site (inside the picker or elsewhere) after a mutation
 * that changes collections or items, so every open picker/thumbnail lookup
 * observes the change without a page reload.
 */
export function invalidatePickerData(): void {
  pickerDataCache = null;
  pickerDataPromise = null;
  for (const notify of listeners) notify();
}

/**
 * Fetches picker data (collections + items) from the portfolio gallery API.
 * Results are cached module-level so the network request only fires once per
 * page session, with concurrent mounts sharing a single in-flight request.
 * Calling `retry()` (or the standalone `invalidatePickerData()`) invalidates
 * the cache and re-fetches in every mounted instance — use it after uploads
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

  // Mount-time fetch: serves the cache silently (no "loading" flash) when hit.
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

  // Invalidation-triggered re-fetch: always flips to "loading" first (cache is
  // known-gone at this point), then re-fetches. Registered as this instance's
  // listener so invalidatePickerData() called from anywhere reaches it.
  const notify = useCallback(() => {
    if (mountedRef.current) setState({ status: "loading" });
    fetchPickerData().then(
      (data) => {
        if (mountedRef.current) setState({ status: "ok", data });
      },
      (err) => {
        if (mountedRef.current) setState({ status: "error", message: String(err) });
      }
    );
  }, []);

  // Event-handler retry — delegates to the shared invalidation path so every
  // mounted instance (not just this one) refreshes.
  const retry = useCallback(() => {
    invalidatePickerData();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    listeners.add(notify);
    subscribe();
    return () => {
      mountedRef.current = false;
      listeners.delete(notify);
    };
  }, [subscribe, notify]);

  return { state, retry };
}

/** Test-only helper — resets the module-level cache and listeners between test runs. */
export function __clearPickerDataCache(): void {
  pickerDataCache = null;
  pickerDataPromise = null;
  listeners.clear();
}
