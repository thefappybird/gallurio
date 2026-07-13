import "server-only";

export { stopWorld } from "./stopWorld";

// Thin wrapper around workflow/runtime's getWorld() lifecycle, used by:
// - instrumentation.ts (startWorld() on boot)
// - server.ts's graceful-shutdown handler (stopWorld() on SIGTERM/SIGINT)
export async function startWorld(): Promise<void> {
  const { getWorld } = await import("workflow/runtime");
  await getWorld().start?.();
}

// Cheap readiness probe for a future health route — round-trips a health
// check message through the configured World's workflow queue.
export async function worldReady(): Promise<{ healthy: boolean; error?: string }> {
  const { getWorld, healthCheck } = await import("workflow/runtime");
  try {
    const result = await healthCheck(getWorld(), "workflow", { timeout: 5_000 });
    return { healthy: result.healthy, error: result.error };
  } catch (err) {
    return { healthy: false, error: err instanceof Error ? err.message : String(err) };
  }
}
