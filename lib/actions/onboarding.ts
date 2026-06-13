"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { connectDB } from "@/lib/db/mongoose";
import {
  Workspace,
  User,
  Client,
  Booking,
  Inquiry,
  ONBOARDING_STEPS,
  type OnboardingStep,
} from "@/lib/db/models";
import { ensureDefaultTeam } from "@/lib/db/models/team";
import { getAuthUser } from "@/lib/auth/session";
import { setActiveWorkspace } from "@/lib/auth/activeWorkspace";
import {
  businessStepSchema,
  brandingStepSchema,
  type BusinessStepInput,
  type BrandingStepInput,
} from "@/lib/validators/workspace";
import mongoose from "mongoose";

type ActionResult = { error?: string; ok?: boolean };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function setUserStep(workosUserId: string, step: OnboardingStep) {
  // Only advance — never regress. If the user is already at a later step
  // (e.g., they went back to edit), keep the existing furthest step.
  const idx = ONBOARDING_STEPS.indexOf(step);
  const earlierSteps = ONBOARDING_STEPS.slice(0, idx);
  await User.findOneAndUpdate(
    { workosUserId, onboardingStep: { $in: earlierSteps } },
    { $set: { onboardingStep: step } }
  );
}

// ---------------------------------------------------------------------------
// Business step
// ---------------------------------------------------------------------------

export async function businessStepAction(
  input: BusinessStepInput
): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const parsed = businessStepSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const {
    firstName,
    lastName,
    name,
    slug,
    businessType,
    country,
    currency,
    timezone,
  } = parsed.data;

  await connectDB();

  // Slug must be globally unique. Exclude the user's own workspace when
  // re-running (idempotent update path) so they are not blocked by their own slug.
  const existingUserDoc = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownedWorkspaceId = existingUserDoc?.memberships.find(
    (m) => m.role === "owner"
  )?.workspaceId ?? null;

  const slugClash = await Workspace.findOne({
    slug,
    ...(ownedWorkspaceId ? { _id: { $ne: ownedWorkspaceId } } : {}),
  }).lean();
  if (slugClash) return { error: "That slug is already taken — try another." };

  const session = await mongoose.startSession();
  let workspaceId: string;

  try {
    await session.withTransaction(async () => {
      // Upsert workspace — keyed by ownerUserId (the WorkOS user id).
      const workspace = await Workspace.findOneAndUpdate(
        { ownerUserId: authUser.workosUserId },
        {
          $set: { name, slug, businessType, country, currency, timezone },
          $setOnInsert: {
            ownerUserId: authUser.workosUserId,
            plan: "free",
          },
        },
        { upsert: true, new: true, session }
      );
      workspaceId = String(workspace._id);

      // Ensure the default team exists for this workspace.
      await ensureDefaultTeam(workspace._id, authUser.workosUserId);

      // Upsert the User document and add owner membership (idempotent via $addToSet).
      const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
      await User.findOneAndUpdate(
        { workosUserId: authUser.workosUserId },
        {
          $set: { name: fullName },
          $setOnInsert: {
            workosUserId: authUser.workosUserId,
            email: authUser.email,
            onboardingStep: "business",
          },
          $addToSet: {
            memberships: { workspaceId: workspace._id, role: "owner" },
          },
        },
        { upsert: true, session }
      );
    });
  } finally {
    await session.endSession();
  }

  await setUserStep(authUser.workosUserId, "branding");

  // Set the signed active-workspace cookie so subsequent steps can resolve
  // the workspace without relying on query params.
  await setActiveWorkspace(authUser.workosUserId, workspaceId!);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Branding step
// ---------------------------------------------------------------------------

export async function brandingStepAction(input: BrandingStepInput): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  const parsed = brandingStepSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  await connectDB();

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownerMembership = user?.memberships.find((m) => m.role === "owner");
  if (!ownerMembership) return { error: "No active workspace — restart onboarding." };

  await Workspace.updateOne(
    { _id: ownerMembership.workspaceId },
    {
      $set: {
        "branding.logoUrl": parsed.data.logoUrl ?? null,
        "branding.logoCloudinaryPublicId": parsed.data.logoCloudinaryPublicId ?? null,
        "branding.primaryColor": parsed.data.primaryColor,
        "branding.secondaryColor": parsed.data.secondaryColor,
        "branding.tagline": parsed.data.tagline ?? "",
        "branding.description": parsed.data.description ?? "",
      },
    }
  );

  await setUserStep(authUser.workosUserId, "plan");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Plan step
// ---------------------------------------------------------------------------

export async function selectFreePlanAction(): Promise<ActionResult> {
  // Free plan path: no Paddle checkout, just record the choice and advance.
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  await connectDB();

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownerMembership = user?.memberships.find((m) => m.role === "owner");
  if (!ownerMembership) return { error: "No active workspace — restart onboarding." };

  await Workspace.updateOne(
    { _id: ownerMembership.workspaceId },
    {
      $set: {
        plan: "free",
        paddleSubscriptionStatus: null,
        paddleCurrentPeriodEnd: null,
        // paddleCustomerId is intentionally preserved — a customer can
        // downgrade to free and re-upgrade without creating a new Paddle customer.
      },
    }
  );

  await setUserStep(authUser.workosUserId, "done");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Paddle reconciliation (done page safety net)
// ---------------------------------------------------------------------------

// Eagerly reconcile the workspace's Paddle subscription state on the done page.
// The webhook + workflow are the authoritative path; this is the safety net for
// cases where the user reaches the done page before the webhook fires.
// Never throws — logs errors and returns silently so the done page always loads.
export async function reconcilePaddleSubscription(workspaceId: string): Promise<void> {
  try {
    await connectDB();
    const workspace = await Workspace.findOne({ _id: workspaceId }).select({
      paddleCustomerId: 1,
      paddleSubscriptionId: 1,
    });
    if (!workspace?.paddleCustomerId) return;

    const { listActiveSubscriptionsForCustomer } = await import("@/lib/paddle/client");
    const { planForPriceId } = await import("@/lib/paddle/plans");
    const { mapPaddleSubscriptionStatus } = await import("@/lib/paddle/status");

    const subs = await listActiveSubscriptionsForCustomer(workspace.paddleCustomerId);
    if (subs.length === 0) return;

    // Pick the most recently created active/trialing subscription.
    const sub = subs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )[0];

    const priceId = sub.items[0]?.price?.id ?? "";
    const plan = planForPriceId(priceId);
    if (plan === "free") return;

    // Map raw Paddle status through the shared normaliser — never write an
    // unmapped string to the DB enum field.
    const paddleSubscriptionStatus = mapPaddleSubscriptionStatus(sub.status);

    // currentBillingPeriod.endsAt is an ISO string; coerce to Date.
    const periodEnd = sub.currentBillingPeriod?.endsAt
      ? new Date(sub.currentBillingPeriod.endsAt)
      : null;

    const $set: Record<string, unknown> = {
      plan,
      paddleSubscriptionId: sub.id,
      paddleCurrentPeriodEnd: periodEnd,
    };
    // Only write status when the mapper recognised the value.
    if (paddleSubscriptionStatus !== null) {
      $set.paddleSubscriptionStatus = paddleSubscriptionStatus;
    }

    await Workspace.updateOne({ _id: workspaceId }, { $set });
  } catch (err) {
    console.error("[onboarding/done] paddle reconcile failed", err);
  }
}

// ---------------------------------------------------------------------------
// Complete onboarding
// ---------------------------------------------------------------------------

export async function completeOnboardingAction(opts: {
  seedSampleData: boolean;
}): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "Not authenticated" };

  await connectDB();

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownerMembership = user?.memberships.find((m) => m.role === "owner");
  if (!ownerMembership) return { error: "No active workspace — restart onboarding." };

  const workspace = await Workspace.findOne({ _id: ownerMembership.workspaceId });
  if (!workspace) return { error: "Workspace not found." };

  if (opts.seedSampleData) {
    await seedSampleData(workspace._id.toString());
  }

  const now = new Date();
  await Promise.all([
    Workspace.updateOne({ _id: workspace._id }, { $set: { onboardingCompletedAt: now } }),
    User.updateOne(
      { workosUserId: authUser.workosUserId },
      { $set: { onboardingStep: "done", onboardingCompletedAt: now } }
    ),
  ]);

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

// ---------------------------------------------------------------------------
// Sample data seed
// ---------------------------------------------------------------------------

async function seedSampleData(workspaceId: string) {
  const existing = await Client.countDocuments({ workspaceId });
  if (existing > 0) return;

  const now = new Date();
  const day = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);
  const slot = (n: number, startHour = 10, endHour = 18) => {
    const start = day(n);
    start.setHours(startHour, 0, 0, 0);
    const end = day(n);
    end.setHours(endHour, 0, 0, 0);
    return { start, end };
  };

  const clients = await Client.insertMany([
    {
      workspaceId,
      name: "Emma & Liam Carter",
      email: "emma.carter@example.com",
      phone: "+1 415 555 0142",
      source: "form",
      tags: ["VIP", "sample"],
    },
    {
      workspaceId,
      name: "Priya Shah",
      email: "priya@example.com",
      phone: "+1 415 555 0188",
      source: "manual",
      tags: ["sample"],
    },
    {
      workspaceId,
      name: "Ana & Tomas Ribeiro",
      email: "ana.ribeiro@example.com",
      source: "referral",
      tags: ["sample"],
    },
    {
      workspaceId,
      name: "Northwood Corp Events",
      email: "events@northwood.example",
      phone: "+1 415 555 0211",
      source: "manual",
      tags: ["sample"],
    },
    {
      workspaceId,
      name: "Jordan Patel",
      email: "jordan.patel@example.com",
      source: "form",
      tags: ["sample"],
    },
  ]);

  const carterSlot = slot(28);
  const shahSlot = slot(14);
  const galaSlot = slot(70);

  await Booking.insertMany([
    {
      workspaceId,
      clientId: clients[0]._id,
      clientName: clients[0].name,
      title: "Carter Wedding -- Pier 27",
      eventType: "wedding",
      status: "booked",
      sessions: [{ startAt: carterSlot.start, endAt: carterSlot.end }],
      firstSessionStart: carterSlot.start,
      lastSessionEnd: carterSlot.end,
      amount: { total: 65000, deposit: 20000, currency: "PHP" },
    },
    {
      workspaceId,
      clientId: clients[1]._id,
      clientName: clients[1].name,
      title: "Shah Engagement Shoot",
      eventType: "wedding",
      status: "booked",
      sessions: [{ startAt: shahSlot.start, endAt: shahSlot.end }],
      firstSessionStart: shahSlot.start,
      lastSessionEnd: shahSlot.end,
      amount: { total: 15000, deposit: 5000, currency: "PHP" },
    },
    {
      workspaceId,
      clientId: clients[3]._id,
      clientName: clients[3].name,
      title: "Northwood Annual Gala",
      eventType: "corporate",
      status: "inquiry",
      sessions: [{ startAt: galaSlot.start, endAt: galaSlot.end }],
      firstSessionStart: galaSlot.start,
      lastSessionEnd: galaSlot.end,
      amount: { total: 90000, deposit: 30000, currency: "PHP" },
    },
  ]);

  await Inquiry.insertMany([
    {
      workspaceId,
      name: "Lena Okafor",
      email: "lena.o@example.com",
      message: "Brand portrait session -- do you take corporate work?",
      eventType: "corporate",
      status: "new",
    },
  ]);
}
