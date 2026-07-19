import { cookies } from "next/headers";
import type { TimeMode } from "@/lib/utils/time-format";

const VALID_MODES: TimeMode[] = ["24h", "12h"];

/** Read the user's time-format preference from the cookie set by updateTimeFormatAction. */
export async function getUserTimeFormat(): Promise<TimeMode> {
  const cookieStore = await cookies();
  const raw = cookieStore.get("timeFormat")?.value;
  return (VALID_MODES.includes(raw as TimeMode) ? raw : "24h") as TimeMode;
}
