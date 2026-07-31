"use server";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { AuthenticationException } from "@workos-inc/node";

import { workos } from "@/lib/workos";
import { ensureUser } from "@/lib/auth/ensureUser";
import { verifyTurnstileToken } from "@/lib/server/turnstile";
import { checkAuthRateLimit } from "@/lib/server/authRateLimit";
import { signOAuthState } from "@/lib/auth/oauthState";
import { isPasswordReusedError } from "@/lib/auth/passwordErrors";
import { authCookieSecure } from "@/lib/auth/cookies";
import { defaultPostAuthPath } from "@/lib/auth/postAuthLanding";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordResetEmail";
import { getClientIp } from "@/lib/server/getClientIp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getClientId(): string {
  return process.env.WORKOS_CLIENT_ID!;
}

async function getIp(): Promise<string | undefined> {
  const h = await headers();
  const ip = getClientIp(h);
  // getClientIp's "unknown" sentinel means no IP header was resolvable —
  // callers here treat that as "no IP" (undefined), same as before.
  return ip === "unknown" ? undefined : ip;
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
const EMAIL_VERIFICATION_PENDING_COOKIE = "wos-email-verify-pending";
const EMAIL_VERIFICATION_TTL_MS = 10 * 60 * 1000;

async function setMfaPendingCookie(
  pendingToken: string,
  challengeId: string,
): Promise<void> {
  const jar = await cookies();
  // Store both tokens as JSON — they expire after 10 min
  jar.set(MFA_PENDING_COOKIE, JSON.stringify({ pendingToken, challengeId }), {
    httpOnly: true,
    secure: await authCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

type EmailVerificationPending = {
  pendingToken: string;
  userId?: string;
  issuedAt?: number;
};

function emailVerificationCookieSecret(): string {
  const secret = process.env.ACTIVE_WORKSPACE_COOKIE_SECRET;
  if (!secret) throw new Error("ACTIVE_WORKSPACE_COOKIE_SECRET is not set");
  return secret;
}

function emailVerificationUserId(err: AuthenticationException): string | undefined {
  const userId = (err.rawData as { user?: { id?: unknown } })?.user?.id;
  return typeof userId === "string" && userId.length > 0 ? userId : undefined;
}

async function setEmailVerificationPendingCookie(
  pendingToken: string,
  userId?: string,
): Promise<void> {
  const jar = await cookies();
  let value = pendingToken;

  // The verification code exchange only needs the pending token. Resend also
  // needs the WorkOS user ID, so preserve it in a signed, short-lived cookie
  // rather than calling withAuth() before WorkOS has issued a session.
  if (userId) {
    const payload = Buffer.from(
      JSON.stringify({ pendingToken, userId, issuedAt: Date.now() }),
    ).toString("base64url");
    const signature = createHmac("sha256", emailVerificationCookieSecret())
      .update(payload)
      .digest("hex");
    value = `v1.${payload}.${signature}`;
  }

  jar.set(EMAIL_VERIFICATION_PENDING_COOKIE, value, {
    httpOnly: true,
    secure: await authCookieSecure(),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
}

async function getEmailVerificationPending(): Promise<EmailVerificationPending | null> {
  const raw = (await cookies()).get(EMAIL_VERIFICATION_PENDING_COOKIE)?.value;
  if (!raw) return null;

  if (!raw.startsWith("v1.")) {
    // Compatibility with a token written before signed resend context existed.
    return { pendingToken: raw };
  }

  const dot = raw.lastIndexOf(".");
  const payload = raw.slice(3, dot);
  const signature = raw.slice(dot + 1);
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", emailVerificationCookieSecret())
    .update(payload)
    .digest("hex");
  try {
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as EmailVerificationPending;
    if (
      typeof parsed.pendingToken !== "string" ||
      typeof parsed.userId !== "string" ||
      typeof parsed.issuedAt !== "number" ||
      Date.now() - parsed.issuedAt > EMAIL_VERIFICATION_TTL_MS
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** Server-rendered expiry timestamp for the verification-code countdown. */
export async function getEmailVerificationExpiresAt(): Promise<number | null> {
  const pending = await getEmailVerificationPending();
  return pending?.issuedAt ? pending.issuedAt + EMAIL_VERIFICATION_TTL_MS : null;
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

async function postAuthRedirect(
  locale: string,
  user: { memberships: { role: "owner" | "staff" }[]; onboardingCompletedAt?: Date | null },
  returnTo?: string,
): Promise<never> {
  const jar = await cookies();
  if (jar.get("gw_invite_token")?.value) {
    redirect("/api/invites/accept");
  }

  const dest = sanitizeReturnTo(returnTo) ?? defaultPostAuthPath(user, locale);
  redirect(dest);
}

async function redirectExpiredVerificationToSignIn(locale: string): Promise<never> {
  (await cookies()).delete(EMAIL_VERIFICATION_PENDING_COOKIE);
  redirect(`/${locale}/sign-in?notice=session_expired`);
}

// ---------------------------------------------------------------------------
// Shared result shape
// ---------------------------------------------------------------------------

export type ActionResult =
  | { error: string; fieldErrors?: Record<string, string> }
  | { ok: true };

type Translator = Awaited<ReturnType<typeof getTranslations>>;

/**
 * A field's keyMap entry is either one message key (single failure mode) or
 * `{ tooBig, default }` when the field's two failure modes need different
 * copy (e.g. "required" vs "too long").
 */
type FieldMessageKey = string | { tooBig: string; default: string };

/**
 * Maps Zod field-level failures to localized messages via `keyMap`, branching
 * on the issue code where a field has more than one message. Fields not
 * present in `keyMap` (turnstileToken, token, returnTo — not user-visible
 * inputs) are silently dropped, never surfaced — the loop walks `keyMap`,
 * never the raw issues, so an unmapped field can never leak through.
 */
function localizeFieldErrors(
  error: z.ZodError,
  keyMap: Record<string, FieldMessageKey>,
  t: Translator,
): Record<string, string> | undefined {
  const mapped: Record<string, string> = {};
  for (const [field, entry] of Object.entries(keyMap)) {
    const issue = error.issues.find((i) => i.path[0] === field);
    if (!issue) continue;
    const messageKey =
      typeof entry === "string"
        ? entry
        : issue.code === "too_big"
          ? entry.tooBig
          : entry.default;
    mapped[field] = t(messageKey);
  }
  return Object.keys(mapped).length > 0 ? mapped : undefined;
}

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
    const fieldErrors = localizeFieldErrors(
      parsed.error,
      {
        email: "errors.fields.emailInvalid",
        password: "errors.fields.passwordRequired",
      },
      t,
    );
    return { error: t("errors.invalidInput"), ...(fieldErrors ? { fieldErrors } : {}) };
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

  let user: { memberships: { role: "owner" | "staff" }[]; onboardingCompletedAt?: Date | null };
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
      secure: await authCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 34_560_000,
    });

    // JIT provision the user
    user = await ensureUser({
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
          await setEmailVerificationPendingCookie(
            pendingToken,
            emailVerificationUserId(err),
          );
        }
        redirect(`/${locale}/verify-email`);
      }
      // Generic — no enumeration: same message for wrong password or unknown email
      return { error: t("errors.invalidCredentials") };
    }
    console.error("[signInAction]", err);
    return { error: t("errors.generic") };
  }

  // redirect() throws a NEXT_REDIRECT control-flow signal. Keep it outside the
  // authentication catch so a successful sign-in is never reported as a 500.
  return postAuthRedirect(locale, user, returnTo);
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
    const fieldErrors = localizeFieldErrors(
      parsed.error,
      {
        firstName: {
          tooBig: "errors.fields.firstNameTooLong",
          default: "errors.fields.firstNameRequired",
        },
        lastName: "errors.fields.lastNameTooLong",
        email: "errors.fields.emailInvalid",
        password: "errors.fields.passwordLength",
        confirmPassword: "errors.fields.confirmPasswordRequired",
      },
      t,
    );
    return { error: t("errors.invalidInput"), ...(fieldErrors ? { fieldErrors } : {}) };
  }

  const { firstName, lastName, email, password, confirmPassword, turnstileToken } =
    parsed.data;

  if (password !== confirmPassword) {
    return {
      error: t("errors.passwordMismatch"),
      fieldErrors: { confirmPassword: t("errors.passwordMismatch") },
    };
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

  let user: { memberships: { role: "owner" | "staff" }[]; onboardingCompletedAt?: Date | null };
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
      secure: await authCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 34_560_000,
    });

    user = await ensureUser({
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
          await setEmailVerificationPendingCookie(
            pendingToken,
            emailVerificationUserId(err),
          );
        }
        redirect(`/${locale}/verify-email`);
      }
      return { error: t("errors.invalidInput") };
    }
    console.error("[signUpAction]", err);
    return { error: t("errors.generic") };
  }

  // See signInAction: Next redirects must not be caught as authentication
  // failures after WorkOS has already created the account and session.
  return postAuthRedirect(locale, user);
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
    const fieldErrors = localizeFieldErrors(
      parsed.error,
      { email: "errors.fields.emailInvalid" },
      t,
    );
    return { error: t("errors.invalidInput"), ...(fieldErrors ? { fieldErrors } : {}) };
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
  try {
    const reset = await workos.userManagement.createPasswordReset({ email });
    const locale = await getLocale();
    const safeLocale = (["en", "fil", "th", "id"] as const).includes(
      locale as "en" | "fil" | "th" | "id",
    )
      ? (locale as "en" | "fil" | "th" | "id")
      : "en";
    await sendPasswordResetEmail(email, reset.passwordResetToken, safeLocale);
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
    const fieldErrors = localizeFieldErrors(
      parsed.error,
      {
        password: "errors.fields.passwordLength",
        confirmPassword: "errors.fields.confirmPasswordRequired",
      },
      t,
    );
    return { error: t("errors.invalidInput"), ...(fieldErrors ? { fieldErrors } : {}) };
  }

  const { token, password, confirmPassword } = parsed.data;

  if (password !== confirmPassword) {
    return {
      error: t("errors.passwordMismatch"),
      fieldErrors: { confirmPassword: t("errors.passwordMismatch") },
    };
  }

  try {
    await workos.userManagement.resetPassword({
      token,
      newPassword: password,
    });
  } catch (err) {
    console.error("[resetPasswordAction]", err);
    if (isPasswordReusedError(err)) {
      return { error: t("errors.passwordReused") };
    }
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
    const fieldErrors = localizeFieldErrors(
      parsed.error,
      { code: "errors.fields.codeInvalid" },
      t,
    );
    return { error: t("errors.invalidCode"), ...(fieldErrors ? { fieldErrors } : {}) };
  }

  const pending = await getEmailVerificationPending();
  const pendingToken = pending?.pendingToken;

  if (!pendingToken) {
    return redirectExpiredVerificationToSignIn(locale);
  }
  const jar = await cookies();

  let user: { memberships: { role: "owner" | "staff" }[]; onboardingCompletedAt?: Date | null };
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
      secure: await authCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 34_560_000,
    });

    jar.delete(EMAIL_VERIFICATION_PENDING_COOKIE);

    user = await ensureUser({
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

  return postAuthRedirect(locale, user);
}

export async function resendVerificationEmailAction(
  // useActionState requires this signature; params are not used in this action
  prev: ActionResult | null, // eslint-disable-line @typescript-eslint/no-unused-vars
  formData: FormData, // eslint-disable-line @typescript-eslint/no-unused-vars
): Promise<ActionResult> {
  const t = await getTranslations("auth");
  const locale = await getLocale();
  const ip = await getIp();

  const pending = await getEmailVerificationPending();
  if (!pending?.userId) {
    return redirectExpiredVerificationToSignIn(locale);
  }

  // Rate limit — prevents inbox spam / WorkOS 429s. Keyed by IP only
  // (session already proves identity; no email dimension needed here).
  const rl = await checkAuthRateLimit({ ip });
  if (!rl.ok) {
    return { error: t("errors.tooManyAttempts", { seconds: rl.retryAfterSec }) };
  }

  try {
    // Calling sendVerificationEmail tells WorkOS to create a new email
    // verification, which fires the `email_verification.created` webhook
    // (`app/api/webhooks/workos/route.ts`). That handler renders and sends
    // the branded Gallurio verification email via Resend. The WorkOS default
    // verification email must be disabled in the dashboard (release-checklist
    // §4g) so the user does not receive two emails. Note: this path relies on
    // WorkOS re-emitting `email_verification.created` on resend — the
    // §4g "re-test the resend path end-to-end" step verifies this live.
    await workos.userManagement.sendVerificationEmail({
      userId: pending.userId,
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
    const fieldErrors = localizeFieldErrors(
      parsed.error,
      { code: "errors.fields.codeInvalid" },
      t,
    );
    return { error: t("errors.invalidCode"), ...(fieldErrors ? { fieldErrors } : {}) };
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

  let user: { memberships: { role: "owner" | "staff" }[]; onboardingCompletedAt?: Date | null };
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
      secure: await authCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 34_560_000,
    });

    jar.delete(MFA_PENDING_COOKIE);

    user = await ensureUser({
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

  return postAuthRedirect(locale, user);
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
    // CSRF: bind the OAuth state to THIS browser. The nonce is stored in a
    // short-lived httpOnly cookie and embedded in the signed state; the callback
    // rejects any request whose cookie nonce does not match the state's. Without
    // this, a valid (code, state) pair could be replayed into a victim's browser
    // to log them into the attacker's account (login CSRF / session fixation).
    const nonce = randomBytes(32).toString("base64url");
    const jar = await cookies();
    jar.set("oauth_csrf", nonce, {
      httpOnly: true,
      secure: await authCookieSecure(),
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });

    const state = signOAuthState({
      locale,
      returnTo: safeReturn,
      nonce,
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
