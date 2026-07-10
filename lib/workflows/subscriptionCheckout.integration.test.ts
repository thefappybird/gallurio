import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
} from "vitest";
import { start, resumeHook } from "workflow/api";
import { waitForHook } from "@workflow/vitest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose, { Types } from "mongoose";
import { Workspace } from "@/lib/db/models/Workspace";
import { subscriptionCheckoutWorkflow } from "./subscriptionCheckout";

// ---------------------------------------------------------------------------
// In-memory MongoDB bootstrap
// ---------------------------------------------------------------------------
// The workflow step calls connectDB(), which reads process.env.DATABASE_URL.
// connectDB() has a test fast-path: if NODE_ENV === "test" and the mongoose
// connection is already open (readyState === 1), it returns without reconnecting.
// So we: (1) start MongoMemoryReplSet → mongoose.connect(), (2) set DATABASE_URL,
// then (3) run steps — the fast-path accepts the pre-opened connection.
// ---------------------------------------------------------------------------

let mongo: MongoMemoryReplSet | null = null;

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1 },
    instanceOpts: [{ launchTimeout: 60_000 }],
  });
  const uri = mongo.getUri();
  // Set DATABASE_URL so connectDB() can satisfy the env check inside steps.
  process.env.DATABASE_URL = uri;
  await mongoose.connect(uri, { bufferCommands: false });

  process.env.LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID = "1001";
}, 120_000);

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongo) {
    await mongo.stop();
    mongo = null;
  }
});

afterEach(async () => {
  if (mongoose.connection.readyState !== 1 || !mongoose.connection.db) return;
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeWorkspaceBase(overrides: Record<string, unknown> = {}) {
  return {
    slug: `ws-${new Types.ObjectId().toHexString()}`,
    name: "Test Workspace",
    ownerUserId: "user_test",
    clerkOrgId: `org_${new Types.ObjectId().toHexString()}`,
    currency: "PHP",
    plan: "free",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("subscriptionCheckoutWorkflow", () => {
  it("persists subscription bookkeeping fields when the hook is resumed", async () => {
    // Seed a workspace in "free" plan with a mock run id.
    // NOTE: `plan` is NOT set by the workflow step — it is the webhook's
    // responsibility (with the team-cap guard applied). The step only writes
    // subscription metadata and clears the checkout run id.
    const ws = await Workspace.create(
      makeWorkspaceBase({
        lsCheckoutWorkflowRunId: "wrun_test_initial",
      })
    );
    const wsId = ws._id.toHexString();

    // Start the workflow. It will suspend on the hook.
    const run = await start(subscriptionCheckoutWorkflow, [wsId, "starter"]);
    expect(run.runId).toMatch(/^wrun_/);

    // Wait for the hook to be created, then resume it with a Lemon Squeezy event.
    await waitForHook(run, { token: `ls-checkout-${wsId}` });

    const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await resumeHook(`ls-checkout-${wsId}`, {
      subscriptionId: "sub_1",
      customerId: "ctm_1",
      status: "active",
      periodEnd,
    });

    // Wait for the workflow to complete
    const result = await run.returnValue;
    expect(result).toEqual({ outcome: "activated", plan: "starter" });

    // Re-fetch the workspace and verify DB state.
    // The workflow step's responsibility: persist subscription bookkeeping
    // fields and clear lsCheckoutWorkflowRunId. `plan` is set by the
    // webhook, not this step, so we do not assert it here.
    const updated = await Workspace.findById(wsId).lean();
    expect(updated).not.toBeNull();
    expect(updated!.lsSubscriptionId).toBe("sub_1");
    expect(updated!.lsCustomerId).toBe("ctm_1");
    expect(updated!.lsSubscriptionStatus).toBe("active");
    expect(updated!.lsCurrentPeriodEnd).toBeInstanceOf(Date);
    // clearCheckoutRunStep must have unset this field
    expect(updated!.lsCheckoutWorkflowRunId).toBeFalsy();
  });

  it("does not touch a second workspace — tenant isolation", async () => {
    // Workspace A — the one that goes through checkout
    const wsA = await Workspace.create(
      makeWorkspaceBase({
        lsCheckoutWorkflowRunId: "wrun_ws_a",
        plan: "free",
      })
    );
    const wsAId = wsA._id.toHexString();

    // Workspace B — must remain completely untouched
    const wsB = await Workspace.create(
      makeWorkspaceBase({
        plan: "free",
        lsSubscriptionId: null,
      })
    );
    const wsBId = wsB._id.toHexString();

    const run = await start(subscriptionCheckoutWorkflow, [wsAId, "starter"]);
    await waitForHook(run, { token: `ls-checkout-${wsAId}` });

    const periodEnd = new Date(Date.now() + 30 * 86_400_000).toISOString();
    await resumeHook(`ls-checkout-${wsAId}`, {
      subscriptionId: "sub_2",
      customerId: "ctm_2",
      status: "active",
      periodEnd,
    });

    await run.returnValue;

    // wsA should have subscription fields written by the step
    const updatedA = await Workspace.findById(wsAId).lean();
    expect(updatedA!.lsSubscriptionId).toBe("sub_2");
    expect(updatedA!.lsSubscriptionStatus).toBe("active");

    // wsB must be entirely unmodified
    const updatedB = await Workspace.findById(wsBId).lean();
    expect(updatedB!.plan).toBe("free");
    expect(updatedB!.lsSubscriptionId).toBeNull();
    expect(updatedB!.lsCustomerId).toBeNull();
    expect(updatedB!.lsSubscriptionStatus).toBeNull();
  });

  it("normalises an unknown lemonsqueezy status to null", async () => {
    const ws = await Workspace.create(makeWorkspaceBase());
    const wsId = ws._id.toHexString();

    const run = await start(subscriptionCheckoutWorkflow, [wsId, "starter"]);
    await waitForHook(run, { token: `ls-checkout-${wsId}` });

    await resumeHook(`ls-checkout-${wsId}`, {
      subscriptionId: "sub_3",
      customerId: "ctm_3",
      status: "unknown_future_status",
      periodEnd: null,
    });

    await run.returnValue;

    const updated = await Workspace.findById(wsId).lean();
    expect(updated!.lsSubscriptionStatus).toBeNull();
    expect(updated!.lsCurrentPeriodEnd).toBeNull();
  });

  it("still writes subscription fields even when status is unknown", async () => {
    // Ensures the step writes subscription id/customer even when the status
    // is unrecognised (normalised to null).
    const ws = await Workspace.create(makeWorkspaceBase({ plan: "free" }));
    const wsId = ws._id.toHexString();

    const run = await start(subscriptionCheckoutWorkflow, [wsId, "starter"]);
    await waitForHook(run, { token: `ls-checkout-${wsId}` });

    await resumeHook(`ls-checkout-${wsId}`, {
      subscriptionId: "sub_4",
      customerId: "ctm_4",
      status: "active",
      periodEnd: null,
    });

    await run.returnValue;

    const updated = await Workspace.findById(wsId).lean();
    // plan stays "free" — not the step's responsibility
    expect(updated!.plan).toBe("free");
    // but the subscription fields were still written
    expect(updated!.lsSubscriptionId).toBe("sub_4");
    expect(updated!.lsCustomerId).toBe("ctm_4");
  });
});
