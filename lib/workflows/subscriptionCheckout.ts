import { createHook } from "workflow";
import {
  updateWorkspacePlanStep,
  clearCheckoutRunStep,
} from "./steps/billing";

export async function subscriptionCheckoutWorkflow(
  workspaceId: string,
  plan: string
) {
  "use workflow";

  using hook = createHook<{
    subscriptionId: string;
    customerId: string;
    status: string;
    periodEnd: string | null;
  }>({
    token: `paddle-checkout-${workspaceId}`,
  });

  const event = await hook;

  await updateWorkspacePlanStep(workspaceId, event);
  await clearCheckoutRunStep(workspaceId);

  return { outcome: "activated", plan } as const;
}
