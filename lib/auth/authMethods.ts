import "server-only";
import { workos } from "@/lib/workos";

export type AuthMethods = {
  hasOAuth: boolean;
  oauthProviders: string[];
};

/**
 * Resolves how a user can authenticate. In this app the only sign-up paths are
 * email+password and Google OAuth, so a user with any OAuth identity signed up
 * via Google and has no password initially. Failure is non-fatal: we default to
 * hasOAuth=false (show the change-password form) and let the caller proceed.
 */
export async function getAuthMethods(
  workosUserId: string,
): Promise<AuthMethods> {
  try {
    const identities = await workos.userManagement.getUserIdentities(
      workosUserId,
    );
    const oauthProviders = identities.map((i) => i.provider);
    return { hasOAuth: oauthProviders.length > 0, oauthProviders };
  } catch (err) {
    console.error("[authMethods] getUserIdentities failed", err);
    return { hasOAuth: false, oauthProviders: [] };
  }
}
