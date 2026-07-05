import "server-only";
import { cookies } from "next/headers";
import { connectDB } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models";
import type { TimeMode } from "@/lib/utils/time-format";

// Single write path for the per-user time-format preference (User.timeFormat +
// the `timeFormat` cookie). Shared by settings' updateTimeFormatAction
// (requireOrg-gated) and onboarding's workspaceStepAction (getAuthUser-gated —
// requireOrg would redirect pre-completion) so the write logic exists once.
export async function persistUserTimeFormat(
  workosUserId: string,
  format: TimeMode
): Promise<void> {
  await connectDB();
  await User.updateOne({ workosUserId }, { $set: { timeFormat: format } });

  const cookieStore = await cookies();
  cookieStore.set("timeFormat", format, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: "lax",
  });
}
