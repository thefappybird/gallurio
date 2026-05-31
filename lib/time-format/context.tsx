"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { TimeMode } from "@/lib/utils/time-format";

interface TimeFormatContextValue {
  timeMode: TimeMode;
  setTimeMode: (f: TimeMode) => void;
}

const TimeFormatContext = createContext<TimeFormatContextValue>({
  timeMode: "24h",
  setTimeMode: () => {},
});

export function TimeFormatProvider({
  children,
  initialValue,
}: {
  children: ReactNode;
  initialValue: TimeMode;
}) {
  const [timeMode, setTimeMode] = useState<TimeMode>(initialValue);
  return (
    <TimeFormatContext.Provider value={{ timeMode, setTimeMode }}>
      {children}
    </TimeFormatContext.Provider>
  );
}

/** Returns the current time format mode for use in client components. */
export function useTimeFormat(): TimeMode {
  return useContext(TimeFormatContext).timeMode;
}

/** Returns the full context value with both getter and setter. */
export function useTimeFormatContext(): TimeFormatContextValue {
  return useContext(TimeFormatContext);
}
