"use client";

import { useEffect } from "react";

/** Keeps number fields text-entry only throughout the app. */
export function DisableNumberInputSteppers() {
  useEffect(() => {
    const isNumberInput = (target: EventTarget | null): target is HTMLInputElement =>
      target instanceof HTMLInputElement && target.type === "number";
    const onWheel = (event: WheelEvent) => {
      if (isNumberInput(event.target) && document.activeElement === event.target) event.preventDefault();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (isNumberInput(event.target) && (event.key === "ArrowUp" || event.key === "ArrowDown")) event.preventDefault();
    };
    document.addEventListener("wheel", onWheel, { capture: true, passive: false });
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("wheel", onWheel, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);
  return null;
}
