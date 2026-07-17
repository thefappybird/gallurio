// pm2 process config. Run from the repo root:
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup
//
// Runtime secrets (DATABASE_URL, WORKOS_*, LEMONSQUEEZY_*, etc.) must be
// present in the process env before pm2 starts this app — load them via a
// `.env` file pm2 reads (or systemd EnvironmentFile), NOT hardcoded in this
// `env` block. lib/env.ts throws at boot if a required var is missing.
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
