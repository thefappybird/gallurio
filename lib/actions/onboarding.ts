"use server";

import { auth, clerkClient } from "@clerk/nextjs/server";
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
import {
  businessStepSchema,
  brandingStepSchema,
  type BusinessStepInput,
  type BrandingStepInput,
} from "@/lib/validators/workspace";

type ActionResult = { error?: string; ok?: boolean };
type BusinessStepResult = ActionResult & { orgIdToActivate?: string };

async function setUserStep(clerkUserId: string, step: OnboardingStep) {
  // Only advance — never regress. If the user is already at a later step
  // (e.g., they went back to edit), keep the existing furthest step.
  const idx = ONBOARDING_STEPS.indexOf(step);
  const earlierSteps = ONBOARDING_STEPS.slice(0, idx);
  await User.findOneAndUpdate(
    { clerkUserId, onboardingStep: { $in: earlierSteps } },
    { $set: { onboardingStep: step } }
  );
}

export async function businessStepAction(
  input: BusinessStepInput
): Promise<BusinessStepResult> {
  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };

  const parsed = businessStepSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  const { firstName, lastName, name, slug, businessType, country, currency, timezone } = parsed.data;
  await connectDB();

  const slugClash = await Workspace.findOne({ slug, clerkOrgId: { $ne: session.orgId ?? "" } }).lean();
  if (slugClash) return { error: "That slug is already taken — try another." };

  const clerk = await clerkClient();

  let clerkOrgId = session.orgId ?? null;

  if (!clerkOrgId) {
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: session.userId,
    });
    clerkOrgId = memberships.data[0]?.organization.id ?? null;
  }

  let orgIdToActivate: string | undefined;

  try {
    if (clerkOrgId) {
      await clerk.organizations.updateOrganization(clerkOrgId, { name });
    } else {
      const org = await clerk.organizations.createOrganization({
        name,
        createdBy: session.userId,
      });
      clerkOrgId = org.id;
      orgIdToActivate = org.id;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update organization";
    return { error: msg };
  }

  const workspace = await Workspace.findOneAndUpdate(
    { clerkOrgId },
    {
      $set: { name, slug, businessType, country, currency, timezone },
      $setOnInsert: { ownerUserId: session.userId, clerkOrgId, plan: "free" },
    },
    { upsert: true, new: true }
  );

  await ensureDefaultTeam(workspace._id, session.userId);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  await User.findOneAndUpdate(
    { clerkUserId: session.userId },
    {
      $set: { name: fullName },
      $setOnInsert: {
        clerkUserId: session.userId,
        email: "",
        onboardingStep: "business",
      },
      $addToSet: { memberships: { workspaceId: workspace._id, role: "owner" } },
    },
    { upsert: true }
  );
  await setUserStep(session.userId, "branding");

  try {
    await clerk.users.updateUser(session.userId, {
      firstName,
      lastName: lastName || undefined,
    });
  } catch (err) {
    console.warn("[onboarding] failed to update Clerk user name", err);
  }

  return { ok: true, orgIdToActivate };
}

export async function brandingStepAction(input: BrandingStepInput): Promise<ActionResult> {
  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };
  if (!session.orgId) return { error: "No active workspace — restart onboarding." };

  const parsed = brandingStepSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.errors[0]?.message ?? "Invalid input" };

  await connectDB();
  await Workspace.updateOne(
    { clerkOrgId: session.orgId },
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
  await setUserStep(session.userId, "plan");
  return { ok: true };
}

export async function selectFreePlanAction(): Promise<ActionResult> {
  // Free plan path: no Paddle checkout, just record the choice and advance.
  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };
  if (!session.orgId) return { error: "No active workspace — restart onboarding." };

  await connectDB();
  await Workspace.updateOne(
    { clerkOrgId: session.orgId },
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
  await setUserStep(session.userId, "done");
  return { ok: true };
}

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

export async function completeOnboardingAction(opts: {
  seedSampleData: boolean;
}): Promise<ActionResult> {
  const session = await auth();
  if (!session.userId) return { error: "Not authenticated" };
  if (!session.orgId) return { error: "No active workspace — restart onboarding." };

  await connectDB();
  const workspace = await Workspace.findOne({ clerkOrgId: session.orgId });
  if (!workspace) return { error: "Workspace not found." };

  if (opts.seedSampleData) {
    await seedSampleData(workspace._id.toString());
  }

  const now = new Date();
  await Promise.all([
    Workspace.updateOne({ _id: workspace._id }, { $set: { onboardingCompletedAt: now } }),
    User.updateOne(
      { clerkUserId: session.userId },
      { $set: { onboardingStep: "done", onboardingCompletedAt: now } }
    ),
  ]);

  const clerk = await clerkClient();
  await clerk.users.updateUser(session.userId, {
    publicMetadata: { onboardingComplete: true },
  });

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

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
      name: "Ana & Tomás Ribeiro",
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
      title: "Carter Wedding — Pier 27",
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
      status: "quoted",
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
      message: "Brand portrait session — do you take corporate work?",
      eventType: "corporate",
      status: "new",
    },
  ]);
}
