"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { AuthenticationException } from "@workos-inc/node";

import { workos } from "@/lib/workos";
import { ensureUser } from "@/lib/auth/ensureUser";
import { getAuthUser } from "@/lib/auth/session";
import { verifyTurnstileToken } from "@/lib/server/turnstile";
import { checkAuthRateLimit } from "@/lib/server/authRateLimit";
import { signOAuthState } from "@/lib/auth/oauthState";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClientId(): string {
  return process.env.WORKOS_CLIENT_ID!;
}

async function getIp(): Promise<string | undefined> {
  const h = await headers();
  // On Vercel, x-vercel-forwarded-for is set by the platform to the real client
  // IP and cannot be spoofed by the client. Prefer it. Otherwise fall back to
  // the LAST entry of x-forwarded-for: the platform appends the real client IP
  // last, while leftmost entries are client-controlled and must never be trusted
  // for rate limiting (a client could rotate them to bypass the per-IP limit).
  const vercelIp = h.get("x-vercel-forwarded-for")?.trim();
  if (vercelIp) return vercelIp;
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return h.get("x-real-ip")?.trim() ?? undefined;
}

/**
 * Cookie name used by @workos-inc/authkit-nextjs for the encrypted session.
 * Matches the constant in that library (falls back to "wos-session").
 */
const SESSION_COOKIE = process.env.WORKOS_COOKIE_NAME ?? "wos-session";

/**
 * Cookie for carrying the pendingAuthenticationToken to the MFA page.
 * Short-lived, httpOnly, not accessible to JS.
 */
const MFA_PENDING_COOKIE = "wos-mfa-pending";

async function setMfaPendingCookie(
  pendingToken: string,
  challengeId: string,
): Promise<void> {
  const jar = await cookies();
  const isProd = process.env.NODE_ENV === "production";
  // Store both tokens as JSON — they expire after 10 min
  jar.set(MFA_PENDING_COOKIE, JSON.stringify({ pendingToken, challengeId }), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

function sanitizeReturnTo(returnTo: string | undefined): string | undefined {
  if (!returnTo) return undefined;
  // Only allow local paths. Second char must not be "/" or "\" — browsers
  // normalize "/\evil.com" in Location headers to protocol-relative
  // "//evil.com", which would be an open redirect.
  if (!/^\/[^/\\]/.test(returnTo)) return undefined;
  // Defense in depth (parity with the OAuth callback route): resolve against a
  // fixed sentinel origin and confirm the result stays on it. Anything that
  // parses to a different origin, or fails to parse, is rejected.
  try {
    const base = "https://gallurio.internal";
    if (new URL(returnTo, base).origin !== base) return undefined;
  } catch {
    return undefined;
  }
  return returnTo;
}

async function buildReturnCookie(returnTo: string | undefined): Promise<string | undefined> {
  return sanitizeReturnTo(returnTo);
}

// ---------------------------------------------------------------------------
// Shared result shape
// ---------------------------------------------------------------------------

export type ActionResult = { error: string } | { ok: true };

// ---------------------------------------------------------------------------
// Sign-in
// ---------------------------------------------------------------------------

const SignInSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  turnstileToken: z.string().min(1),
  returnTo: z.string().optional(),
});

export async function signInAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("auth");
  const locale = await getLocale();
  const ip = await getIp();

  const parsed = SignInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    turnstileToken: formData.get("cf-turnstile-response"),
    returnTo: formData.get("returnTo") ?? undefined,
  });

  if (!parsed.success) {
    return { error: t("errors.invalidInput") };
  }

  const { email, password, turnstileToken, returnTo } = parsed.data;

  // Bot check
  const cfOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!cfOk) {
    return { error: t("errors.botCheck") };
  }

  // Rate limit
  const rl = await checkAuthRateLimit({ email, ip });
  if (!rl.ok) {
    return {
      error: t("errors.tooManyAttempts", { seconds: rl.retryAfterSec }),
    };
  }

  try {
    const response = await workos.userManagement.authenticateWithPassword({
      clientId: getClientId(),
      email,
      password,
      session: { sealSession: true, cookiePassword: process.env.WORKOS_COOKIE_PASSWORD! },
    });

    const jar = await cookies();
    jar.set(SESSION_COOKIE, response.sealedSession!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 34_560_000,
    });

    // JIT provision the user
    await ensureUser({
      workosUserId: response.user.id,
      email: response.user.email,
      name: [response.user.firstName, response.user.lastName]
        .filter(Boolean)
        .join(" "),
      avatarUrl: response.user.profilePictureUrl ?? null,
    });
  } catch (err) {
    if (err instanceof AuthenticationException) {
      if (
        err.code === "mfa_enrollment" ||
        err.code === "mfa_challenge" ||
        err.code === "mfa_verification"
      ) {
        const pendingToken = err.pendingAuthenticationToken;
        if (pendingToken) {
          // Challenge the first enrolled TOTP factor
          let challengeId: string | undefined;
          try {
            // Get the user to find their enrolled factor
            const userId = (err.rawData as { user?: { id?: string } })?.user?.id;
            if (userId) {
              const factors =
                await workos.multiFactorAuth.listUserAuthFactors({ userId });
              const totpFactor = factors.data.find(
                (f: { type: string }) => f.type === "totp",
              );
              if (totpFactor) {
                const challenge =
                  await workos.multiFactorAuth.challengeFactor({
                    authenticationFactorId: (totpFactor as { id: string }).id,
                  });
                challengeId = challenge.id;
              }
            }
          } catch {
            // If we can't challenge, fall through to redirect with what we have
          }
          if (challengeId) {
            await setMfaPendingCookie(pendingToken, challengeId);
          }
          redirect(`/${locale}/sign-in/mfa`);
        }
      }
      if (err.code === "email_verification_required") {
        const pendingToken = err.pendingAuthenticationToken;
        if (pendingToken) {
          const jar = await cookies();
          jar.set("wos-email-verify-pending", pendingToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600,
          });
        }
        redirect(`/${locale}/verify-email`);
      }
      // Generic — no enumeration: same message for wrong password or unknown email
      return { error: t("errors.invalidCredentials") };
    }
    console.error("[signInAction]", err);
    return { error: t("errors.generic") };
  }

  const dest = sanitizeReturnTo(returnTo) ?? `/${locale}/onboarding`;
  redirect(dest);
}

// ---------------------------------------------------------------------------
// Sign-up
// ---------------------------------------------------------------------------

const SignUpSchema = z.object({
  firstName: z.string().min(1).max(80),
  lastName: z.string().max(80).optional(),
  email: z.string().email(),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(1),
  turnstileToken: z.string().min(1),
});

export async function signUpAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("auth");
  const locale = await getLocale();
  const ip = await getIp();

  const parsed = SignUpSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName") ?? undefined,
    email: formData.get("email"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
    turnstileToken: formData.get("cf-turnstile-response"),
  });

  if (!parsed.success) {
    return { error: t("errors.invalidInput") };
  }

  const { firstName, lastName, email, password, confirmPassword, turnstileToken } =
    parsed.data;

  if (password !== confirmPassword) {
    return { error: t("errors.passwordMismatch") };
  }

  // Bot check
  const cfOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!cfOk) {
    return { error: t("errors.botCheck") };
  }

  // Rate limit
  const rl = await checkAuthRateLimit({ email, ip });
  if (!rl.ok) {
    return {
      error: t("errors.tooManyAttempts", { seconds: rl.retryAfterSec }),
    };
  }

  try {
    await workos.userManagement.createUser({
      email,
      password,
      firstName,
      lastName: lastName ?? undefined,
    });

    // Immediately authenticate to get a session
    const response = await workos.userManagement.authenticateWithPassword({
      clientId: getClientId(),
      email,
      password,
      session: { sealSession: true, cookiePassword: process.env.WORKOS_COOKIE_PASSWORD! },
    });

    const jar = await cookies();
    jar.set(SESSION_COOKIE, response.sealedSession!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 34_560_000,
    });

    await ensureUser({
      workosUserId: response.user.id,
      email: response.user.email,
      name: [response.user.firstName, response.user.lastName]
        .filter(Boolean)
        .join(" "),
      avatarUrl: response.user.profilePictureUrl ?? null,
    });
  } catch (err) {
    if (err instanceof AuthenticationException) {
      if (err.code === "email_verification_required") {
        const pendingToken = err.pendingAuthenticationToken;
        if (pendingToken) {
          const jar = await cookies();
          jar.set("wos-email-verify-pending", pendingToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 600,
          });
        }
        redirect(`/${locale}/verify-email`);
      }
      return { error: t("errors.invalidInput") };
    }
    console.error("[signUpAction]", err);
    return { error: t("errors.generic") };
  }

  redirect(`/${locale}/onboarding`);
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------

const ForgotPasswordSchema = z.object({
  email: z.string().email(),
  turnstileToken: z.string().min(1),
});

export async function forgotPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("auth");
  const ip = await getIp();

  const parsed = ForgotPasswordSchema.safeParse({
    email: formData.get("email"),
    turnstileToken: formData.get("cf-turnstile-response"),
  });

  if (!parsed.success) {
    return { error: t("errors.invalidInput") };
  }

  const { email, turnstileToken } = parsed.data;

  // Bot check
  const cfOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!cfOk) {
    return { error: t("errors.botCheck") };
  }

  // Rate limit — use IP only to avoid revealing if email exists
  const rl = await checkAuthRateLimit({ ip });
  if (!rl.ok) {
    return {
      error: t("errors.tooManyAttempts", { seconds: rl.retryAfterSec }),
    };
  }

  // Fire-and-forget — NEVER reveal whether the email exists.
  // createPasswordReset returns a token + URL; we send it via the app email provider.
  try {
    const reset = await workos.userManagement.createPasswordReset({ email });
    // Send the reset URL by email. Use the reset URL returned by WorkOS directly —
    // it already points to WorkOS hosted flow. For first-party flow, override the URL:
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${reset.passwordResetToken}`;
    // Attempt to send via Resend if configured; failure is intentionally swallowed.
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Gallurio";
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${appName} <noreply@${new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://gallurio.app").hostname}>`,
          to: [email],
          subject: `Reset your ${appName} password`,
          html: `<p>Click the link below to reset your password. It expires soon.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
        }),
      });
    }
  } catch {
    // Swallow intentionally — no enumeration
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reset password
// ---------------------------------------------------------------------------

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(128),
  confirmPassword: z.string().min(1),
});

export async function resetPasswordAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("auth");

  const parsed = ResetPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: t("errors.invalidInput") };
  }

  const { token, password, confirmPassword } = parsed.data;

  if (password !== confirmPassword) {
    return { error: t("errors.passwordMismatch") };
  }

  try {
    await workos.userManagement.resetPassword({
      token,
      newPassword: password,
    });
  } catch (err) {
    console.error("[resetPasswordAction]", err);
    return { error: t("errors.resetTokenInvalid") };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Verify email
// ---------------------------------------------------------------------------

const VerifyEmailSchema = z.object({
  code: z.string().length(6),
});

export async function verifyEmailAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("auth");
  const locale = await getLocale();

  const parsed = VerifyEmailSchema.safeParse({
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return { error: t("errors.invalidCode") };
  }

  const jar = await cookies();
  const pendingToken = jar.get("wos-email-verify-pending")?.value;

  if (!pendingToken) {
    return { error: t("errors.sessionExpired") };
  }

  try {
    const response =
      await workos.userManagement.authenticateWithEmailVerification({
        clientId: getClientId(),
        code: parsed.data.code,
        pendingAuthenticationToken: pendingToken,
        session: { sealSession: true, cookiePassword: process.env.WORKOS_COOKIE_PASSWORD! },
      });

    jar.set(SESSION_COOKIE, response.sealedSession!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 34_560_000,
    });

    jar.delete("wos-email-verify-pending");

    await ensureUser({
      workosUserId: response.user.id,
      email: response.user.email,
      name: [response.user.firstName, response.user.lastName]
        .filter(Boolean)
        .join(" "),
      avatarUrl: response.user.profilePictureUrl ?? null,
    });
  } catch (err) {
    console.error("[verifyEmailAction]", err);
    return { error: t("errors.invalidCode") };
  }

  redirect(`/${locale}/onboarding`);
}

export async function resendVerificationEmailAction(
  // useActionState requires this signature; params are not used in this action
  prev: ActionResult | null, // eslint-disable-line @typescript-eslint/no-unused-vars
  formData: FormData, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<ActionResult> {
  const t = await getTranslations("auth");

  const authUser = await getAuthUser();
  if (!authUser) {
    return { error: t("errors.sessionExpired") };
  }

  try {
    await workos.userManagement.sendVerificationEmail({
      userId: authUser.workosUserId,
    });
  } catch (err) {
    console.error("[resendVerificationEmailAction]", err);
    return { error: t("errors.generic") };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// MFA challenge
// ---------------------------------------------------------------------------

const MfaChallengeSchema = z.object({
  code: z.string().length(6),
});

export async function mfaChallengeAction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const t = await getTranslations("auth");
  const locale = await getLocale();
  const ip = await getIp();

  const parsed = MfaChallengeSchema.safeParse({
    code: formData.get("code"),
  });

  if (!parsed.success) {
    return { error: t("errors.invalidCode") };
  }

  // Rate limit — MFA brute-force prevention
  const rl = await checkAuthRateLimit({ ip });
  if (!rl.ok) {
    return {
      error: t("errors.tooManyAttempts", { seconds: rl.retryAfterSec }),
    };
  }

  const jar = await cookies();
  const rawCookie = jar.get(MFA_PENDING_COOKIE)?.value;

  if (!rawCookie) {
    return { error: t("errors.sessionExpired") };
  }

  let pendingToken: string;
  let challengeId: string;

  try {
    const parsed2 = JSON.parse(rawCookie) as {
      pendingToken: string;
      challengeId: string;
    };
    pendingToken = parsed2.pendingToken;
    challengeId = parsed2.challengeId;
  } catch {
    return { error: t("errors.sessionExpired") };
  }

  try {
    const response = await workos.userManagement.authenticateWithTotp({
      clientId: getClientId(),
      code: parsed.data.code,
      pendingAuthenticationToken: pendingToken,
      authenticationChallengeId: challengeId,
      session: { sealSession: true, cookiePassword: process.env.WORKOS_COOKIE_PASSWORD! },
    });

    jar.set(SESSION_COOKIE, response.sealedSession!, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 34_560_000,
    });

    jar.delete(MFA_PENDING_COOKIE);

    await ensureUser({
      workosUserId: response.user.id,
      email: response.user.email,
      name: [response.user.firstName, response.user.lastName]
        .filter(Boolean)
        .join(" "),
      avatarUrl: response.user.profilePictureUrl ?? null,
    });
  } catch (err) {
    console.error("[mfaChallengeAction]", err);
    return { error: t("errors.invalidCode") };
  }

  redirect(`/${locale}/onboarding`);
}

// ---------------------------------------------------------------------------
// Google OAuth — returns the authorization URL (called from client)
// ---------------------------------------------------------------------------

export async function googleSignInAction(
  returnTo?: string,
): Promise<{ url: string } | { error: string }> {
  const t = await getTranslations("auth");
  const locale = await getLocale();

  const safeReturn = await buildReturnCookie(returnTo);

  try {
    const state = signOAuthState({
      locale,
      returnTo: safeReturn,
    });

    const url = workos.userManagement.getAuthorizationUrl({
      clientId: getClientId(),
      provider: "GoogleOAuth",
      redirectUri: process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI!,
      state,
    });

    return { url };
  } catch (err) {
    console.error("[googleSignInAction]", err);
    return { error: t("errors.generic") };
  }
}
