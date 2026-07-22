"use client";

// Threads the active demo session + image-cap-gate callback down to the demo
// image picker leaf components inside StyleToolkitField.tsx, without prop-drilling
// through every intermediate panel (BannerSection/ContentInputs/etc). Provided
// once by EditorShell when demoMode is true; null (default) in the real editor.

import { createContext, useContext } from "react";

export type DemoPickerCtx = {
  demoSessionId: string;
  /** Called when an upload hits the 10-image demo cap, so the caller can open
   *  the shared DemoGateModal ("imageCap" gate) instead of showing a plain error. */
  onImageCapHit: () => void;
} | null;

export const DemoPickerContext = createContext<DemoPickerCtx>(null);

export function useDemoPicker(): DemoPickerCtx {
  return useContext(DemoPickerContext);
}
