// Raw-Node-safe Workflow shutdown adapter. This module is imported by the
// custom tsx server before Next.js prepares its compiler, so it cannot use
// Next's `server-only` marker.
//
// World.stop() does not exist on the interface — the lifecycle method is
// close(). Named stopWorld (not "close") so the graceful-shutdown wiring has
// one clear symbol to call.
export async function stopWorld(): Promise<void> {
  const { getWorld } = await import("workflow/runtime");
  await getWorld().close?.();
}
