// Boots the Workflow DevKit World at server startup so durable checkout runs
// (subscriptionCheckoutWorkflow) resume across restarts on the World
// configured via WORKFLOW_TARGET_WORLD (Postgres in production, Local in dev
// when unset). Next.js runs this register() hook from `app.prepare()`, which
// fires under the custom server too (server.ts calls `next().prepare()`), so
// no separate server.ts wiring is needed. See lib/workflows/world.ts for the
// stopWorld()/worldReady() helpers used at shutdown and by a future health
// route.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "edge") {
    const { startWorld } = await import("./lib/workflows/world");
    await startWorld();
  }
}
