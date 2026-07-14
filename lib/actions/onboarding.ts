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
import { persistUserTimeFormat } from "@/lib/auth/persistTimeFormat";
import { grantPlan } from "@/lib/billing/grantPlan";
import { isBetaProgramClosed } from "@/lib/billing/betaProgram";
import {
  businessStepSchema,
  workspaceSetupSchema,
  COUNTRY_TO_CURRENCY,
  type BusinessStepInput,
  type WorkspaceSetupInput,
} from "@/lib/validators/workspace";
import mongoose from "mongoose";

type ActionResult = { error?: string; ok?: boolean };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return base || "workspace";
}

// businessStepAction has no slug field of its own (it moved to the workspace
// step) but still needs SOME unique slug to satisfy the required+unique
// index on first insert. Auto-derive one from the business name; the owner
// can rename it on the next step.
async function generateUniqueSlug(name: string): Promise<string> {
  const base = slugifyName(name);
  let candidate = base;
  let suffix = 1;
  while (await Workspace.exists({ slug: candidate })) {
    suffix += 1;
    candidate = `${base}-${suffix}`.slice(0, 50);
  }
  return candidate;
}

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
  if (!authUser) return { error: "not_authenticated" };

  const parsed = businessStepSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const { firstName, lastName, name, businessType } = parsed.data;

  await connectDB();

  // One workspace per email — a user who already belongs to someone else's
  // workspace (as staff) can't also start their own. They must use another
  // email. An existing owner membership is safe to proceed with: it can only
  // point at this same user's own workspace (upserted by ownerUserId below).
  const existingUser = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1, freeTrialConsumedAt: 1 },
  ).lean();
  const belongsElsewhere = existingUser?.memberships.some((m) => m.role !== "owner");
  if (belongsElsewhere) return { error: "already_member_elsewhere" };

  // One free Pro month per user (email), applied at workspace creation only
  // — a repeat businessStepAction call (workspace already exists) hits the
  // upsert's update path, not insert, so $setOnInsert below never re-grants.
  const grantFreeMonth = !existingUser?.freeTrialConsumedAt;
  const freeMonthExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  // The workspace's URL slug is edited on the next step, but the Workspace
  // schema requires one on insert — auto-derive it from the business name
  // now; $setOnInsert below means it only applies the first time.
  const autoSlug = await generateUniqueSlug(name);

  let workspaceId: string;
  let session: mongoose.ClientSession | null = null;

  try {
    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // Upsert workspace — keyed by ownerUserId (the WorkOS user id).
      const workspace = await Workspace.findOneAndUpdate(
        { ownerUserId: authUser.workosUserId },
        {
          $set: { name, businessType },
          $setOnInsert: {
            ownerUserId: authUser.workosUserId,
            slug: autoSlug,
            // First workspace for this user (email): full-Pro one-month grant,
            // no card. Repeat user (trial already consumed): plain free —
            // gated until they subscribe. See lib/billing/access.ts.
            plan: grantFreeMonth ? "pro" : "free",
            ...(grantFreeMonth ? { planGrantExpiresAt: freeMonthExpiresAt } : {}),
            // Seed the inquiry recipient with the owner's auth email so
            // notifications are delivered from day one, without requiring a
            // settings visit.
            "publicPage.inquiryRecipientEmail": authUser.email,
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
          $set: {
            name: fullName,
            ...(grantFreeMonth ? { freeTrialConsumedAt: new Date() } : {}),
          },
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
  } catch (err) {
    // Race-safe: if two concurrent requests slip through the pre-write check
    // simultaneously, the second hits the unique index on `slug` (E11000).
    // Map this to the same friendly message instead of propagating the error.
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === 11000
    ) {
      return { error: "url_taken" };
    }
    throw err;
  } finally {
    if (session) await session.endSession();
  }

  await setUserStep(authUser.workosUserId, "workspace");

  // Set the signed active-workspace cookie so subsequent steps can resolve
  // the workspace without relying on query params.
  await setActiveWorkspace(authUser.workosUserId, workspaceId!);

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Workspace setup step
// ---------------------------------------------------------------------------

export async function workspaceStepAction(
  input: WorkspaceSetupInput
): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "not_authenticated" };

  const parsed = workspaceSetupSchema.safeParse(input);
  if (!parsed.success) return { error: "invalid_input" };

  const { slug, country, timezone, timeFormat } = parsed.data;
  // Currency is never client-submitted — always derived from country.
  const currency = COUNTRY_TO_CURRENCY[country];

  await connectDB();

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownerMembership = user?.memberships.find((m) => m.role === "owner");
  if (!ownerMembership) return { error: "onboarding_no_active_workspace" };

  // Slug must be globally unique. Exclude the user's own workspace so
  // keeping (or re-submitting) their existing slug never self-clashes.
  const slugClash = await Workspace.findOne({
    slug,
    _id: { $ne: ownerMembership.workspaceId },
  }).lean();
  if (slugClash) return { error: "url_taken" };

  try {
    await Workspace.updateOne(
      { _id: ownerMembership.workspaceId },
      { $set: { slug, country, currency, timezone } }
    );
  } catch (err) {
    // Race-safe: if two concurrent requests slip through the pre-write check
    // simultaneously, the second hits the unique index on `slug` (E11000).
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: unknown }).code === 11000
    ) {
      return { error: "url_taken" };
    }
    throw err;
  }

  await persistUserTimeFormat(authUser.workosUserId, timeFormat);

  await setUserStep(authUser.workosUserId, "plan");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Plan step
// ---------------------------------------------------------------------------

export async function selectFreePlanAction(): Promise<ActionResult> {
  // No permanent free tier: this step no longer grants anything. A
  // first-timer's workspace already carries the one-month free-Pro grant
  // applied at creation (businessStepAction) — this just advances past the
  // plan step. A repeat user (trial already consumed, no grant on this
  // workspace) must subscribe instead.
  const authUser = await getAuthUser();
  if (!authUser) return { error: "not_authenticated" };

  await connectDB();

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownerMembership = user?.memberships.find((m) => m.role === "owner");
  if (!ownerMembership) return { error: "onboarding_no_active_workspace" };

  const workspace = await Workspace.findOne(
    { _id: ownerMembership.workspaceId },
    { planGrantExpiresAt: 1 }
  ).lean();

  const hasActiveGrant =
    !!workspace?.planGrantExpiresAt && workspace.planGrantExpiresAt > new Date();
  if (!hasActiveGrant) return { error: "free_trial_already_used" };

  await setUserStep(authUser.workosUserId, "done");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Beta tester activation — gated by an env var rather than NODE_ENV so it
// can be flipped on in any environment (including production, for real beta
// testers) and removed later just by unsetting the var.
// ---------------------------------------------------------------------------

export async function activateBetaTesterAction(): Promise<ActionResult> {
  if (process.env.BETA_TESTER_ENABLED !== "true") {
    return { error: "Beta tester program is not enabled" };
  }

  const authUser = await getAuthUser();
  if (!authUser) return { error: "not_authenticated" };

  await connectDB();

  if (await isBetaProgramClosed()) return { error: "beta_program_closed" };

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownerMembership = user?.memberships.find((m) => m.role === "owner");
  if (!ownerMembership) return { error: "onboarding_no_active_workspace" };

  await grantPlan(ownerMembership.workspaceId, { plan: "beta", expiresAt: null });

  // Set once, permanently — durable identity-level evidence of beta
  // participation, independent of the workspace's plan.
  await User.updateOne(
    { workosUserId: authUser.workosUserId, "betaParticipation.recordedAt": null },
    { $set: { "betaParticipation.recordedAt": new Date(), "betaParticipation.source": "onboarding" } }
  );

  await setUserStep(authUser.workosUserId, "done");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Lemon Squeezy reconciliation (done page safety net)
// ---------------------------------------------------------------------------

// Eagerly reconcile the workspace's Lemon Squeezy subscription state on the
// done page. The webhook + workflow are the authoritative path; this is the
// safety net for cases where the user reaches the done page before the
// webhook fires. Never throws — logs errors and returns silently so the done
// page always loads.
export async function reconcileLemonSqueezySubscription(workspaceId: string): Promise<void> {
  try {
    await connectDB();
    const workspace = await Workspace.findOne({ _id: workspaceId }).select({
      lsSubscriptionId: 1,
    });
    if (!workspace) return;

    const authUser = await getAuthUser();
    const email = authUser?.email;
    if (!email) return;

    const { listActiveSubscriptionsForEmail } = await import("@/lib/lemonsqueezy/client");
    const { planForVariantId } = await import("@/lib/lemonsqueezy/plans");
    const { mapLemonSqueezySubscriptionStatus } = await import("@/lib/lemonsqueezy/status");

    const subs = await listActiveSubscriptionsForEmail(email);
    if (subs.length === 0) return;

    // Pick the most recently created subscription.
    const sub = subs.sort(
      (a, b) =>
        new Date(b.attributes.created_at as string).getTime() -
        new Date(a.attributes.created_at as string).getTime()
    )[0];

    const variantId = sub.attributes.variant_id != null ? String(sub.attributes.variant_id) : "";
    const plan = planForVariantId(variantId);
    if (plan === "free") return;

    // Defence-in-depth: listActiveSubscriptionsForEmail is scoped by the
    // signed-in user's email, not this workspace. A user who owns multiple
    // workspaces (or reuses an email across workspaces) could otherwise reach
    // this safety net for a brand-new, unpaid workspace and have it silently
    // inherit a DIFFERENT workspace's already-active subscription. Refuse to
    // bind a subscription that's already claimed by another workspace.
    const boundElsewhere = await Workspace.findOne({
      _id: { $ne: workspaceId },
      lsSubscriptionId: sub.id,
    })
      .select({ _id: 1 })
      .lean();
    if (boundElsewhere) return;

    // Map raw Lemon Squeezy status through the shared normaliser — never
    // write an unmapped string to the DB enum field.
    const lsSubscriptionStatus = mapLemonSqueezySubscriptionStatus(
      sub.attributes.status as string | null | undefined
    );

    const renewsAt = sub.attributes.renews_at as string | null | undefined;
    const periodEnd = renewsAt ? new Date(renewsAt) : null;

    const $set: Record<string, unknown> = {
      plan,
      everSubscribed: true,
      lsSubscriptionId: sub.id,
      lsCurrentPeriodEnd: periodEnd,
    };
    // Only write status when the mapper recognised the value.
    if (lsSubscriptionStatus !== null) {
      $set.lsSubscriptionStatus = lsSubscriptionStatus;
    }

    await Workspace.updateOne({ _id: workspaceId }, { $set });
  } catch (err) {
    console.error("[onboarding/done] lemonsqueezy reconcile failed", err);
  }
}

// ---------------------------------------------------------------------------
// Complete onboarding
// ---------------------------------------------------------------------------

export async function completeOnboardingAction(opts: {
  seedSampleData: boolean;
}): Promise<ActionResult> {
  const authUser = await getAuthUser();
  if (!authUser) return { error: "not_authenticated" };

  await connectDB();

  const user = await User.findOne(
    { workosUserId: authUser.workosUserId },
    { memberships: 1 }
  ).lean();
  const ownerMembership = user?.memberships.find((m) => m.role === "owner");
  if (!ownerMembership) return { error: "onboarding_no_active_workspace" };

  const workspace = await Workspace.findOne({ _id: ownerMembership.workspaceId });
  if (!workspace) return { error: "workspace_not_found" };

  if (opts.seedSampleData && process.env.NODE_ENV === "development") {
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
      status: "booked",
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
      status: "inquiry",
      eventDate: slot(21).start,
    },
  ]);
}
