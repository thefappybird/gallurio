// pm2 process config. Run from the repo root:
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup
//
// Workflow DevKit World (durable checkout): WORKFLOW_TARGET_WORLD,
// WORKFLOW_POSTGRES_URL (and optional WORKFLOW_POSTGRES_JOB_PREFIX /
// WORKFLOW_POSTGRES_WORKER_CONCURRENCY) must be present in the process env
// before pm2 starts this app — load them via a `.env` file pm2 reads (or
// systemd EnvironmentFile), NOT hardcoded in this `env` block. lib/env.ts
// throws at boot if these are missing or still point at the Local World.
// Before the FIRST deploy, run the one-time Postgres schema bootstrap
// against WORKFLOW_POSTGRES_URL: `pnpm exec workflow-postgres-setup`.
// The World starts/stops with the app process itself (instrumentation.ts
// register() on boot; graceful shutdown calls lib/workflows/world.ts's
// stopWorld()) — no separate worker process to manage under pm2.
module.exports = {
  apps: [
    {
      name: "gallurio",
      script: "pnpm",
      args: "start", // cross-env NODE_ENV=production tsx server.ts (package.json)
      cwd: __dirname + "/..",
      env: { NODE_ENV: "production" },
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
