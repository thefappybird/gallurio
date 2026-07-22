"use client";

import { createContext, useContext } from "react";

export const DemoGuideChromeContext = createContext<((open: boolean) => void) | null>(null);

/** Lets the demo editor temporarily replace public chrome with its full-screen guide. */
export function useDemoGuideChrome() {
  return useContext(DemoGuideChromeContext);
}
