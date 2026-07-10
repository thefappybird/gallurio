// Steps that update the Workspace Lemon Squeezy billing fields.
//
// IMPORTANT: This file intentionally imports ONLY npm packages (mongoose,
// workflow/...). Project-local TypeScript files cannot be imported here because
// the @workflow/vitest builder externalises non-step local files as .js paths
// at runtime, and those compiled .js files don't exist in the source tree.
//
// Attempted import: @/lib/lemonsqueezy/status.ts is a zero-dependency leaf, but
// @workflow/vitest still resolves it as lib/lemonsqueezy/status.js (a compiled
// path that doesn't exist in the source tree), causing ERR_MODULE_NOT_FOUND. As
// a last resort the status switch is inlined here.
// KEEP IN SYNC WITH lib/lemonsqueezy/status.ts — mapLemonSqueezySubscriptionStatus().
//
// The test's beforeAll imports Workspace from the project source, which
// registers the model in mongoose's global registry before any step runs.
// The step then retrieves it with mongoose.model('Workspace').

import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Inlined status normaliser (KEEP IN SYNC WITH lib/lemonsqueezy/status.ts)
// ---------------------------------------------------------------------------

type LemonSqueezySubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "paused"
  | "trialing";

function mapLemonSqueezySubscriptionStatus(
  raw: string | null | undefined
): LemonSqueezySubscriptionStatus | null {
  switch (raw) {
    case "on_trial":
      return "trialing";
    case "active":
      return "active";
    case "paused":
      return "paused";
    case "past_due":
      return "past_due";
    case "unpaid":
      return "past_due";
    case "cancelled":
      return "canceled";
    case "expired":
      return "canceled";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// DB connection helper (inline — avoids importing project-local connectDB.ts)
// ---------------------------------------------------------------------------

async function ensureConnected(): Promise<void> {
  if (mongoose.connection.readyState === 1) return; // already open
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("Missing DATABASE_URL environment variable");
  await mongoose.connect(uri, { bufferCommands: false });
}

// ---------------------------------------------------------------------------
// Steps
// ---------------------------------------------------------------------------

// NOTE: This step intentionally does NOT write the `plan` field. The webhook
// (app/api/webhooks/lemonsqueezy/route.ts) is the authoritative writer for
// `plan` and applies the team-cap downgrade guard before calling resumeHook.
// The step only persists subscription bookkeeping fields and clears the run
// id. Writing `plan` here would race against the webhook's team-cap guard and
// produce non-deterministic results on over-cap activations.
export async function updateWorkspacePlanStep(
  workspaceId: string,
  event: {
    subscriptionId: string;
    customerId: string;
    status: string;
    periodEnd: string | null;
  }
) {
  "use step";
  await ensureConnected();

  const lsSubscriptionStatus = mapLemonSqueezySubscriptionStatus(event.status);

  const $set: Record<string, unknown> = {
    lsSubscriptionId: event.subscriptionId,
    lsCustomerId: event.customerId,
    lsSubscriptionStatus,
    lsCurrentPeriodEnd: event.periodEnd ? new Date(event.periodEnd) : null,
  };

  // Retrieve via registry — model registered by the caller's import of Workspace.ts.
  const WorkspaceModel = mongoose.model("Workspace");
  await WorkspaceModel.updateOne({ _id: workspaceId }, { $set });
}

export async function clearCheckoutRunStep(workspaceId: string) {
  "use step";
  await ensureConnected();

  const WorkspaceModel = mongoose.model("Workspace");
  await WorkspaceModel.updateOne(
    { _id: workspaceId },
    { $unset: { lsCheckoutWorkflowRunId: "" } }
  );
}
