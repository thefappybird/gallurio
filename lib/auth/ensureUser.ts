import "server-only";
import { connectDB } from "@/lib/db/mongoose";
import { User, type UserDoc } from "@/lib/db/models";
import type { AuthUser } from "./session";

/**
 * JIT-provisions a User document from a verified WorkOS auth user.
 *
 * Idempotent: safe to call on every authenticated request. Uses findOneAndUpdate
 * with upsert so concurrent first-time sign-ins resolve to one document.
 * Email/name/avatarUrl are always synced from WorkOS so profile changes propagate
 * without any explicit sync job.
 *
 * Returns the full User document (after upsert).
 */
export async function ensureUser(authUser: AuthUser): Promise<UserDoc> {
  await connectDB();

  const user = await User.findOneAndUpdate(
    { workosUserId: authUser.workosUserId },
    {
      $set: {
        email: authUser.email.toLowerCase().trim(),
        name: authUser.name,
        avatarUrl: authUser.avatarUrl,
      },
      $setOnInsert: {
        workosUserId: authUser.workosUserId,
        memberships: [],
        mfaEnabled: false,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // findOneAndUpdate with upsert + new:true always returns a document.
  return user!;
}
