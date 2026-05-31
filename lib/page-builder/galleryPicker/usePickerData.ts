"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PickerData } from "./types";

type State =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; data: PickerData };

/**
 * Fetches picker data (collections + items) from the portfolio gallery API.
 * Retries on error via the returned `retry` callback.
 */
export function usePickerData() {
  // Start in "loading" so the mount effect doesn't have to setState synchronously
  // (which the React Compiler flags as a cascading render). The effect only kicks
  // off the fetch; setState happens after the request settles.
  const [state, setState] = useState<State>({ status: "loading" });
  const abortRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch("/api/portfolio/gallery", { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PickerData;
        setState({ status: "ok", data });
      })
      .catch((err) => {
        if ((err as { name?: string }).name === "AbortError") return;
        setState({ status: "error", message: String(err) });
      });
  }, []);

  // Event-handler retry may setState synchronously (it's not an effect).
  const retry = useCallback(() => {
    setState({ status: "loading" });
    runFetch();
  }, [runFetch]);

  useEffect(() => {
    runFetch();
    return () => {
      abortRef.current?.abort();
    };
  }, [runFetch]);

  return { state, retry };
}
