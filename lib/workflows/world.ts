import "server-only";

// Thin wrapper around workflow/runtime's getWorld() lifecycle, used by:
// - instrumentation.ts (startWorld() on boot)
// - server.ts's future graceful-shutdown handler (stopWorld() on SIGTERM/SIGINT)
export async function startWorld(): Promise<void> {
  const { getWorld } = await import("workflow/runtime");
  await getWorld().start?.();
}

// World.stop() does not exist on the interface — the lifecycle method is
// close(). Named stopWorld (not "close") so server.ts's future SIGTERM/
// SIGINT handler has one clear symbol to call.
export async function stopWorld(): Promise<void> {
  const { getWorld } = await import("workflow/runtime");
  await getWorld().close?.();
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
