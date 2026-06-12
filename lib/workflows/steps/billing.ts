// Steps that update the Workspace Paddle billing fields.
//
// IMPORTANT: This file intentionally imports ONLY npm packages (mongoose,
// workflow/...). Project-local TypeScript files cannot be imported here because
// the @workflow/vitest builder externalises non-step local files as .js paths
// at runtime, and those compiled .js files don't exist in the source tree.
//
// Attempted import: @/lib/paddle/status.ts is a zero-dependency leaf, but
// @workflow/vitest still resolves it as lib/paddle/status.js (a compiled path
// that doesn't exist in the source tree), causing ERR_MODULE_NOT_FOUND. As a
// last resort the status switch is inlined here.
// KEEP IN SYNC WITH lib/paddle/status.ts — mapPaddleSubscriptionStatus().
//
// The test's beforeAll imports Workspace from the project source, which
// registers the model in mongoose's global registry before any step runs.
// The step then retrieves it with mongoose.model('Workspace').

import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Inlined status normaliser (KEEP IN SYNC WITH lib/paddle/status.ts)
// ---------------------------------------------------------------------------

type PaddleSubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "paused"
  | "trialing";

function mapPaddleSubscriptionStatus(
  raw: string | null | undefined
): PaddleSubscriptionStatus | null {
  switch (raw) {
    case "active":
      return "active";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "past_due":
      return "past_due";
    case "paused":
      return "paused";
    case "trialing":
      return "trialing";
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
// (app/api/webhooks/paddle/route.ts) is the authoritative writer for `plan`
// and applies the team-cap downgrade guard before calling resumeHook. The
// step only persists subscription bookkeeping fields and clears the run id.
// Writing `plan` here would race against the webhook's team-cap guard and
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

  const paddleSubscriptionStatus = mapPaddleSubscriptionStatus(event.status);

  const $set: Record<string, unknown> = {
    paddleSubscriptionId: event.subscriptionId,
    paddleCustomerId: event.customerId,
    paddleSubscriptionStatus,
    paddleCurrentPeriodEnd: event.periodEnd ? new Date(event.periodEnd) : null,
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
    { $unset: { paddleCheckoutWorkflowRunId: "" } }
  );
}
