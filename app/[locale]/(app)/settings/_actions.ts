"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { AuthenticationException } from "@workos-inc/node";
import { checkAuthRateLimit } from "@/lib/server/authRateLimit";
import { Workspace, User } from "@/lib/db/models";
import {
  updateWorkspaceBusinessSchema,
  publicPageSettingsSchema,
  type UpdateWorkspaceBusinessInput,
  type PublicPageSettingsInput,
} from "@/lib/validators/workspace";
import { sendPasswordResetEmail } from "@/lib/email/sendPasswordResetEmail";
import { deleteImage } from "@/lib/storage/cloudflareImages";
import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { authCookieSecure } from "@/lib/auth/cookies";
import { workos } from "@/lib/workos";
import { connectDB } from "@/lib/db/mongoose";
import { setActiveWorkspace } from "@/lib/auth/activeWorkspace";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { routing } from "@/lib/i18n/routing";

// ---------------------------------------------------------------------------
// Workspace business settings
// ---------------------------------------------------------------------------

export async function updateWorkspaceBusinessAction(
  input: UpdateWorkspaceBusinessInput,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = updateWorkspaceBusinessSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { name, slug, businessType, country, currency, timezone } = parsed.data;

  const slugClash = await Workspace.findOne({
    slug,
    _id: { $ne: ctx.workspace._id },
  }).lean();
  if (slugClash) return { error: "That URL is already taken — try another." };

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { name, slug, businessType, country, currency, timezone } },
  );

  revalidatePath("/settings/workspace", "page");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Public page settings
// ---------------------------------------------------------------------------

export async function updatePublicPageSettingsAction(
  input: PublicPageSettingsInput,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = publicPageSettingsSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: {
        "publicPage.seoTitle": parsed.data.seoTitle ?? "",
        "publicPage.seoDescription": parsed.data.seoDescription ?? "",
        "publicPage.inquiryRecipientEmail":
          parsed.data.inquiryRecipientEmail ?? "",
      },
    },
  );

  revalidatePath("/settings/public-page", "page");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Toggle public page published state
// ---------------------------------------------------------------------------

export async function togglePublicPagePublishedAction(
  next: boolean,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.publishedAt": next ? new Date() : null } },
  );

  revalidatePath("/settings/public-page", "page");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Time format preference (any authenticated member)
// ---------------------------------------------------------------------------

const timeModeSchema = z.enum(["24h", "12h"]);

export async function updateTimeFormatAction(
  format: string,
): Promise<ActionResult> {
  const ctx = await requireOrg();

  const parsed = timeModeSchema.safeParse(format);
  if (!parsed.success) return { error: "Invalid time format" };

  await User.updateOne(
    { workosUserId: ctx.userId },
    { $set: { timeFormat: parsed.data } },
  );

  const cookieStore = await cookies();
  cookieStore.set("timeFormat", parsed.data, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    httpOnly: false,
    sameSite: "lax",
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile: update display name
// ---------------------------------------------------------------------------

const updateNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(80, "Name is too long"),
});

export async function updateProfileNameAction(input: {
  name: string;
}): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const parsed = updateNameSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { name } = parsed.data;
  const [firstName, ...rest] = name.split(" ");
  const lastName = rest.join(" ") || undefined;

  try {
    await workos.userManagement.updateUser({
      userId: authUser.workosUserId,
      firstName: firstName ?? "",
      lastName: lastName ?? "",
    });
  } catch (err) {
    console.error("[settings] WorkOS updateUser failed", err);
    return { error: "Failed to update name. Please try again." };
  }

  await connectDB();
  await User.updateOne(
    { workosUserId: authUser.workosUserId },
    { $set: { name } },
  );

  revalidatePath("/settings", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// MFA: enroll TOTP authenticator
// Returns QR code data URI + plain secret for display.
// The challenge ID and factor ID are stored server-side in a short-lived
// httpOnly cookie so the client cannot supply or tamper with them.
// ---------------------------------------------------------------------------

const MFA_ENROLL_COOKIE = "gw_mfa_enroll";
// How long the enrollment session (QR code / challenge) stays valid, in seconds.
const MFA_ENROLL_TTL_SEC = 600;

export type EnrollMfaResult =
  | { error: string }
  | { qrCode: string; secret: string; expiresAt: number };

export async function enrollMfaAction(): Promise<EnrollMfaResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  try {
    const { authenticationFactor, authenticationChallenge } =
      await workos.multiFactorAuth.createUserAuthFactor({
        userId: authUser.workosUserId,
        type: "totp",
        totpIssuer: "Gallurio",
        totpUser: authUser.email,
      });

    const totp = authenticationFactor.totp as {
      qrCode: string;
      secret: string;
    };

    const jar = await cookies();
    jar.set(
      MFA_ENROLL_COOKIE,
      JSON.stringify({
        factorId: authenticationFactor.id,
        challengeId: authenticationChallenge.id,
      }),
      {
        httpOnly: true,
        secure: await authCookieSecure(),
        sameSite: "lax",
        path: "/",
        maxAge: MFA_ENROLL_TTL_SEC,
      },
    );

    return {
      qrCode: totp.qrCode,
      secret: totp.secret,
      // Absolute expiry so the client can show a countdown and prompt a refresh
      // before the server-side enrollment cookie lapses.
      expiresAt: Date.now() + MFA_ENROLL_TTL_SEC * 1000,
    };
  } catch (err) {
    console.error("[settings] createUserAuthFactor failed", err);
    return { error: "Failed to start MFA setup. Please try again." };
  }
}

// ---------------------------------------------------------------------------
// MFA: verify challenge to complete enrollment
// The challengeId is read from the server-set httpOnly cookie — the client
// supplies only the 6-digit TOTP code.
// ---------------------------------------------------------------------------

export async function verifyMfaEnrollmentAction(input: {
  code: string;
}): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const codeSchema = z.string().regex(/^\d{6}$/, "Code must be 6 digits");
  if (!codeSchema.safeParse(input.code).success)
    return { error: "Code must be 6 digits" };

  const jar = await cookies();
  const rawCookie = jar.get(MFA_ENROLL_COOKIE)?.value;
  if (!rawCookie)
    return { error: "Enrollment session expired. Restart setup." };

  // The challenge is bound to this authenticated user: it was minted by
  // enrollMfaAction() and stored in a server-set, httpOnly cookie the client
  // cannot read or forge. verifyChallenge() below ties the code to that exact
  // challenge, so no further ownership check is needed. (A prior
  // listUserAuthFactors() guard was removed: WorkOS does not list a factor as
  // owned until it is verified, so it rejected every legitimate enrollment.)
  let challengeId: string;
  try {
    const parsed = JSON.parse(rawCookie) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).challengeId !== "string"
    ) {
      return { error: "Enrollment session expired. Restart setup." };
    }
    challengeId = (parsed as Record<string, string>).challengeId;
  } catch {
    return { error: "Enrollment session expired. Restart setup." };
  }

  try {
    const result = await workos.multiFactorAuth.verifyChallenge({
      authenticationChallengeId: challengeId,
      code: input.code,
    });

    if (!result.valid) return { error: "Invalid code. Please try again." };
  } catch (err) {
    console.error("[settings] verifyChallenge failed", err);
    return { error: "Invalid or expired code. Please try again." };
  }

  await connectDB();
  await User.updateOne(
    { workosUserId: authUser.workosUserId },
    { $set: { mfaEnabled: true } },
  );

  jar.delete(MFA_ENROLL_COOKIE);

  revalidatePath("/settings", "page");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// MFA: disable — delete all TOTP factors for the authenticated user
// ---------------------------------------------------------------------------

export async function disableMfaAction(): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  try {
    const factors = await workos.multiFactorAuth.listUserAuthFactors({
      userId: authUser.workosUserId,
    });

    await Promise.all(
      factors.data.map((f) => workos.multiFactorAuth.deleteFactor(f.id)),
    );
  } catch (err) {
    console.error("[settings] deleteFactor failed", err);
    return { error: "Failed to disable MFA. Please try again." };
  }

  await connectDB();
  await User.updateOne(
    { workosUserId: authUser.workosUserId },
    { $set: { mfaEnabled: false } },
  );

  revalidatePath("/settings", "page");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Workspace switcher: switch active workspace (membership-validated)
// ---------------------------------------------------------------------------

export async function setActiveWorkspaceAction(
  workspaceId: string,
): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  await connectDB();

  const user = await User.findOne({
    workosUserId: authUser.workosUserId,
  }).lean();
  if (!user) return { error: "User not found" };

  const isMember = user.memberships.some(
    (m) => String(m.workspaceId) === workspaceId,
  );
  if (!isMember) return { error: "Workspace not found" };

  await setActiveWorkspace(authUser.workosUserId, workspaceId);

  const locale = await getLocale();
  const dashboardPath =
    locale === routing.defaultLocale
      ? "/dashboard"
      : `/${locale}/dashboard`;

  redirect(dashboardPath);
}

// ---------------------------------------------------------------------------
// Profile: change password
// Verifies the current password via WorkOS authenticateWithPassword before
// setting the new password via updateUser. Handles MFA-gated accounts where
// the password is correct but a further step is required.
// ---------------------------------------------------------------------------

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
  confirmPassword: z.string().min(1),
});

// AuthenticationException codes that fire only AFTER WorkOS has accepted the
// password (a further step — MFA, Radar bot check, email verification, org
// selection — is pending). For current-password verification these all mean the
// password was correct. `sso_required` is intentionally excluded: it means the
// account has no usable password, which should not count as a successful check.
const PASSWORD_OK_CODES = new Set([
  "mfa_challenge",
  "mfa_enrollment",
  "mfa_verification",
  "radar_email_challenge",
  "radar_sms_challenge",
  "email_verification_required",
  "organization_selection_required",
]);

export async function updatePasswordAction(input: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const parsed = updatePasswordSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword)
    return { error: "Passwords do not match." };

  const rl = await checkAuthRateLimit({ email: authUser.email });
  if (!rl.ok)
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSec} seconds.`,
    };

  // Verify the current password by attempting authentication.
  try {
    await workos.userManagement.authenticateWithPassword({
      clientId: process.env.WORKOS_CLIENT_ID!,
      email: authUser.email,
      password: currentPassword,
    });
  } catch (err) {
    if (err instanceof AuthenticationException) {
      if (!PASSWORD_OK_CODES.has(err.code)) {
        return { error: "Current password is incorrect." };
      }
      // Password was correct; a pending step (e.g. MFA) is fine here.
    } else {
      console.error("[settings] authenticateWithPassword failed", err);
      return {
        error: "Could not verify your current password. Please try again.",
      };
    }
  }

  try {
    await workos.userManagement.updateUser({
      userId: authUser.workosUserId,
      password: newPassword,
    });
  } catch (err) {
    console.error("[settings] updateUser(password) failed", err);
    return { error: "Failed to update password. Please try again." };
  }

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile: update avatar (user-scoped, not workspace-scoped)
// ---------------------------------------------------------------------------

const updateAvatarSchema = z.object({
  avatarUrl: z
    .string()
    .url("Avatar URL must be a valid URL")
    .startsWith("https://", "Avatar URL must use HTTPS")
    .nullable(),
  avatarAssetId: z.string().nullable(),
});

export async function updateAvatarAction(input: {
  avatarUrl: string | null;
  avatarAssetId: string | null;
}): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const parsed = updateAvatarSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  await connectDB();

  let previousPublicId: string | null;
  const nextPublicId = parsed.data.avatarAssetId;

  try {
    const userDoc = await User.findOne({
      workosUserId: authUser.workosUserId,
    }).lean();

    previousPublicId = userDoc?.avatarAssetId ?? null;

    await User.updateOne(
      { workosUserId: authUser.workosUserId },
      {
        $set: {
          avatarUrl: parsed.data.avatarUrl,
          avatarAssetId: nextPublicId,
        },
      },
    );
  } catch (err) {
    console.error("[settings] updateAvatarAction DB write failed", err);
    return { error: "Failed to update photo. Please try again." };
  }

  if (previousPublicId && previousPublicId !== nextPublicId) {
    try {
      await deleteImage(previousPublicId);
    } catch (err) {
      console.warn("[settings] failed to delete old avatar asset", err);
    }
  }

  revalidatePath("/settings", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Profile: send "set a password" email for OAuth-only users
// Mints a WorkOS password-reset token and emails the link via the shared
// sendPasswordResetEmail helper. Authenticated + rate-limited.
// ---------------------------------------------------------------------------

export async function sendSetPasswordEmailAction(): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const rl = await checkAuthRateLimit({ email: authUser.email });
  if (!rl.ok)
    return {
      error: `Too many attempts. Try again in ${rl.retryAfterSec} seconds.`,
    };

  try {
    const reset = await workos.userManagement.createPasswordReset({
      email: authUser.email,
    });
    await sendPasswordResetEmail(authUser.email, reset.passwordResetToken);
  } catch (err) {
    console.error("[settings] sendSetPasswordEmail failed", err);
    return { error: "Could not send the email. Please try again." };
  }

  return { ok: true };
}
