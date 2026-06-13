"use server";

import { signOut as workosSignOut } from "@workos-inc/authkit-nextjs";
import { clearActiveWorkspace } from "./activeWorkspace";

/**
 * Signs the current user out. Clears both the WorkOS session cookie and the
 * active-workspace cookie, then redirects to /sign-in.
 */
export async function signOutAction(): Promise<void> {
  await clearActiveWorkspace();
  // workosSignOut() deletes the wos-session cookie and redirects — it does
  // not return to the caller.
  await workosSignOut({ returnTo: "/sign-in" });
}
