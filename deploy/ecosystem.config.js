// pm2 process config. Run from the repo root:
//   pm2 start deploy/ecosystem.config.js
//   pm2 save && pm2 startup
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
