"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import {
  Workspace,
  User,
  Client,
  Booking,
  Inquiry,
  Transaction,
  ActivityLog,
  GalleryCollection,
  GalleryItem,
} from "@/lib/db/models";
import {
  updateWorkspaceBusinessSchema,
  updateWorkspaceBrandingSchema,
  publicPageSettingsSchema,
  type UpdateWorkspaceBusinessInput,
  type UpdateWorkspaceBrandingInput,
  type PublicPageSettingsInput,
} from "@/lib/validators/workspace";
import { cancelSubscription } from "@/lib/paddle/client";
import { destroyAsset } from "@/lib/storage/cloudinary";
import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import { requireOrg } from "@/lib/auth/requireOrg";
import { getAuthUser } from "@/lib/auth/session";
import { workos } from "@/lib/workos";
import { connectDB } from "@/lib/db/mongoose";
import { serializeCsv } from "@/lib/utils/csv-serialize";
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
// Workspace branding settings
// ---------------------------------------------------------------------------

export async function updateWorkspaceBrandingAction(
  input: UpdateWorkspaceBrandingInput,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = updateWorkspaceBrandingSchema.safeParse(input);
  if (!parsed.success)
    return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const previousLogoId =
    ctx.workspace.branding?.logoCloudinaryPublicId ?? null;
  const nextLogoId = parsed.data.logoCloudinaryPublicId ?? null;

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: {
        "branding.logoUrl": parsed.data.logoUrl ?? null,
        "branding.logoCloudinaryPublicId": nextLogoId,
        "branding.primaryColor": parsed.data.primaryColor,
        "branding.secondaryColor": parsed.data.secondaryColor,
        "branding.tagline": parsed.data.tagline ?? "",
        "branding.description": parsed.data.description ?? "",
      },
    },
  );

  if (previousLogoId && previousLogoId !== nextLogoId) {
    try {
      await destroyAsset(previousLogoId);
    } catch (err) {
      console.warn("[settings] failed to delete old logo asset", err);
    }
  }

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
// Delete workspace
// ---------------------------------------------------------------------------

export async function deleteWorkspaceAction(
  confirmation: string,
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  if (confirmation.trim() !== ctx.workspace.slug) {
    return { error: "Confirmation does not match the workspace URL." };
  }

  if (
    ctx.workspace.paddleSubscriptionId &&
    ctx.workspace.paddleSubscriptionStatus === "active"
  ) {
    try {
      await cancelSubscription(ctx.workspace.paddleSubscriptionId);
    } catch (err) {
      console.warn("[settings] failed to cancel Paddle subscription", err);
    }
  }

  const galleryItems = await GalleryItem.find(
    { workspaceId: ctx.workspace._id },
    { cloudinaryPublicId: 1 },
  ).lean();
  const publicIds = [
    ctx.workspace.branding?.logoCloudinaryPublicId,
    ...galleryItems.map((i) => i.cloudinaryPublicId),
  ].filter((id): id is string => typeof id === "string" && id.length > 0);

  await Promise.allSettled(publicIds.map((id) => destroyAsset(id)));

  const wid = ctx.workspace._id;
  await Promise.all([
    Booking.deleteMany({ workspaceId: wid }),
    Client.deleteMany({ workspaceId: wid }),
    Inquiry.deleteMany({ workspaceId: wid }),
    Transaction.deleteMany({ workspaceId: wid }),
    ActivityLog.deleteMany({ workspaceId: wid }),
    GalleryItem.deleteMany({ workspaceId: wid }),
    GalleryCollection.deleteMany({ workspaceId: wid }),
  ]);

  await Promise.all([
    User.updateMany(
      { "memberships.workspaceId": wid },
      { $pull: { memberships: { workspaceId: wid } } },
    ),
    Workspace.deleteOne({ _id: wid }),
  ]);

  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Request data export
// ---------------------------------------------------------------------------

export async function requestDataExportAction(): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  await connectDB();

  const ownerUser = await User.findOne({ workosUserId: ctx.userId })
    .select({ email: 1 })
    .lean();
  if (!ownerUser?.email) return { error: "Could not find owner email" };

  const [bookings, clients, inquiries] = await Promise.all([
    Booking.find({ workspaceId: ctx.workspace._id }).lean(),
    Client.find({ workspaceId: ctx.workspace._id }).lean(),
    Inquiry.find({ workspaceId: ctx.workspace._id }).lean(),
  ]);

  const bookingsCsv = serializeCsv(
    [
      "id",
      "title",
      "status",
      "eventType",
      "clientName",
      "firstSessionStart",
      "lastSessionEnd",
      "locationAddress",
      "amountTotal",
      "amountDeposit",
      "currency",
      "notes",
    ],
    bookings.map((b) => [
      String(b._id),
      b.title,
      b.status,
      b.eventType ?? "",
      b.clientName,
      b.firstSessionStart?.toISOString() ?? "",
      b.lastSessionEnd?.toISOString() ?? "",
      b.location?.address ?? "",
      String(b.amount?.total ?? 0),
      String(b.amount?.deposit ?? 0),
      b.amount?.currency ?? "PHP",
      b.notes ?? "",
    ]),
  );

  const clientsCsv = serializeCsv(
    [
      "id",
      "name",
      "email",
      "phone",
      "tags",
      "source",
      "totalSpent",
      "bookingsCount",
      "lastBookingAt",
      "isActive",
      "notes",
    ],
    clients.map((c) => [
      String(c._id),
      c.name,
      c.email ?? "",
      c.phone ?? "",
      (c.tags ?? []).join(";"),
      c.source ?? "",
      String(c.totalSpent ?? 0),
      String(c.bookingsCount ?? 0),
      c.lastBookingAt?.toISOString() ?? "",
      String(c.isActive !== false),
      c.notes ?? "",
    ]),
  );

  const inquiriesCsv = serializeCsv(
    [
      "id",
      "name",
      "email",
      "phone",
      "message",
      "eventDate",
      "eventType",
      "status",
      "createdAt",
    ],
    inquiries.map((i) => [
      String(i._id),
      i.name,
      i.email,
      i.phone ?? "",
      i.message ?? "",
      i.eventDate?.toISOString() ?? "",
      i.eventType ?? "",
      i.status,
      (i as unknown as { createdAt?: Date }).createdAt?.toISOString() ?? "",
    ]),
  );

  const { resend } = await import("@/lib/email/resend");
  const { buildDataExportEmailBody } = await import(
    "@/lib/email/templates/data-export"
  );

  const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
  const result = await resend.emails.send({
    from,
    to: ownerUser.email,
    subject: `Your workspace data export — ${ctx.workspace.name}`,
    text: buildDataExportEmailBody({ workspaceName: ctx.workspace.name }),
    attachments: [
      { filename: "bookings.csv", content: Buffer.from(bookingsCsv) },
      { filename: "clients.csv", content: Buffer.from(clientsCsv) },
      { filename: "inquiries.csv", content: Buffer.from(inquiriesCsv) },
    ],
  });

  if (result.error) {
    console.error("[settings] data-export email failed", result.error);
    return { error: "Failed to send export email. Please try again." };
  }

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

export type EnrollMfaResult =
  | { error: string }
  | { qrCode: string; secret: string };

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
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      },
    );

    return {
      qrCode: totp.qrCode,
      secret: totp.secret,
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

  let factorId: string;
  let challengeId: string;
  try {
    const parsed = JSON.parse(rawCookie) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>).factorId !== "string" ||
      typeof (parsed as Record<string, unknown>).challengeId !== "string"
    ) {
      return { error: "Enrollment session expired. Restart setup." };
    }
    factorId = (parsed as Record<string, string>).factorId;
    challengeId = (parsed as Record<string, string>).challengeId;
  } catch {
    return { error: "Enrollment session expired. Restart setup." };
  }

  // Defense in depth: confirm the factor belongs to the authenticated user
  // before verifying the challenge.
  try {
    const factors = await workos.multiFactorAuth.listUserAuthFactors({
      userId: authUser.workosUserId,
    });
    const owns = factors.data.some(
      (f: { id: string }) => f.id === factorId,
    );
    if (!owns)
      return { error: "Enrollment session expired. Restart setup." };
  } catch (err) {
    console.error("[settings] listUserAuthFactors failed", err);
    return { error: "Failed to verify MFA enrollment. Please try again." };
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
