"use server";

import { clerkClient } from "@clerk/nextjs/server";
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
import { cancelRecurringBilling } from "@/lib/hitpay/client";
import { destroyAsset } from "@/lib/storage/cloudinary";
import { ownerContext, type ActionResult } from "@/lib/auth/ownerContext";
import { connectDB } from "@/lib/db/mongoose";
import { serializeCsv } from "@/lib/utils/csv-serialize";

export async function updateWorkspaceBusinessAction(
  input: UpdateWorkspaceBusinessInput
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = updateWorkspaceBusinessSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { name, slug, businessType, country, currency, timezone } = parsed.data;

  const slugClash = await Workspace.findOne({
    slug,
    _id: { $ne: ctx.workspace._id },
  }).lean();
  if (slugClash) return { error: "That URL is already taken — try another." };

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { name, slug, businessType, country, currency, timezone } }
  );

  // Keep Clerk Organisation name in sync with the workspace name so the
  // OrganizationSwitcher chip stays accurate. Non-fatal if it fails.
  try {
    const clerk = await clerkClient();
    await clerk.organizations.updateOrganization(ctx.clerkOrgId, { name });
  } catch (err) {
    console.warn("[settings] failed to sync Clerk org name", err);
  }

  revalidatePath("/settings/workspace", "page");
  return { ok: true };
}

export async function updateWorkspaceBrandingAction(
  input: UpdateWorkspaceBrandingInput
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = updateWorkspaceBrandingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const previousLogoId = ctx.workspace.branding?.logoCloudinaryPublicId ?? null;
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
    }
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

export async function updatePublicPageSettingsAction(
  input: PublicPageSettingsInput
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = publicPageSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    {
      $set: {
        "publicPage.seoTitle": parsed.data.seoTitle ?? "",
        "publicPage.seoDescription": parsed.data.seoDescription ?? "",
        "publicPage.inquiryRecipientEmail": parsed.data.inquiryRecipientEmail ?? "",
      },
    }
  );

  revalidatePath("/settings/public-page", "page");
  return { ok: true };
}

export async function togglePublicPagePublishedAction(
  next: boolean
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  await Workspace.updateOne(
    { _id: ctx.workspace._id },
    { $set: { "publicPage.publishedAt": next ? new Date() : null } }
  );

  revalidatePath("/settings/public-page", "page");
  return { ok: true };
}

export async function deleteWorkspaceAction(
  confirmation: string
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  if (confirmation.trim() !== ctx.workspace.slug) {
    return { error: "Confirmation does not match the workspace URL." };
  }

  // Best-effort subscription cancellation — never block the delete on this.
  if (
    ctx.workspace.hitpayRecurringBillingId &&
    ctx.workspace.hitpayRecurringStatus === "active"
  ) {
    try {
      await cancelRecurringBilling(ctx.workspace.hitpayRecurringBillingId);
    } catch (err) {
      console.warn("[settings] failed to cancel HitPay subscription", err);
    }
  }

  // Gather Cloudinary public IDs we own across the workspace so we can wipe
  // the storage in the background. Logo + every gallery item.
  const galleryItems = await GalleryItem.find(
    { workspaceId: ctx.workspace._id },
    { cloudinaryPublicId: 1 }
  ).lean();
  const publicIds = [
    ctx.workspace.branding?.logoCloudinaryPublicId,
    ...galleryItems.map((i) => i.cloudinaryPublicId),
  ].filter((id): id is string => typeof id === "string" && id.length > 0);

  // Fire-and-forget Cloudinary deletes — if any fail the assets become
  // orphaned in our cloud bucket but the user's workspace is gone either way.
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
      { $pull: { memberships: { workspaceId: wid } } }
    ),
    Workspace.deleteOne({ _id: wid }),
  ]);

  try {
    const clerk = await clerkClient();
    await clerk.organizations.deleteOrganization(ctx.clerkOrgId);
  } catch (err) {
    console.warn("[settings] failed to delete Clerk organisation", err);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function requestDataExportAction(): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  await connectDB();

  const ownerUser = await User.findOne({ clerkUserId: ctx.userId })
    .select({ email: 1 })
    .lean();
  if (!ownerUser?.email) return { error: "Could not find owner email" };

  const [bookings, clients, inquiries] = await Promise.all([
    Booking.find({ workspaceId: ctx.workspace._id }).lean(),
    Client.find({ workspaceId: ctx.workspace._id }).lean(),
    Inquiry.find({ workspaceId: ctx.workspace._id }).lean(),
  ]);

  const bookingsCsv = serializeCsv(
    ["id", "title", "status", "eventType", "clientName", "firstSessionStart", "lastSessionEnd", "locationAddress", "amountTotal", "amountDeposit", "currency", "notes"],
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
    ])
  );

  const clientsCsv = serializeCsv(
    ["id", "name", "email", "phone", "tags", "source", "totalSpent", "bookingsCount", "lastBookingAt", "isActive", "notes"],
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
    ])
  );

  const inquiriesCsv = serializeCsv(
    ["id", "name", "email", "phone", "message", "eventDate", "eventType", "status", "createdAt"],
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
    ])
  );

  const { resend } = await import("@/lib/email/resend");
  const { buildDataExportEmailBody } = await import("@/lib/email/templates/data-export");

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

const timeModeSchema = z.enum(["24h", "12h"]);

export async function updateTimeFormatAction(
  format: string
): Promise<ActionResult> {
  const ctx = await ownerContext();
  if ("error" in ctx) return { error: ctx.error };

  const parsed = timeModeSchema.safeParse(format);
  if (!parsed.success) return { error: "Invalid time format" };

  await User.updateOne(
    { clerkUserId: ctx.userId },
    { $set: { timeFormat: parsed.data } }
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
