import { z } from "zod";

// This module is also imported by the raw `tsx server.ts` entrypoint before
// Next.js installs its compiler aliases, so it cannot use Next's `server-only`
// marker. Keep its consumers server-side instead.

// Fail-fast production environment validation.
//
// `validateEnv()` must be called explicitly at RUNTIME STARTUP (server.ts) —
// never as an import-time side effect. `next build` runs with
// NODE_ENV=production against whatever machine happens to build the app
// (often lacking real prod secrets); an import-time throw would break every
// build. Only an explicit startup call is safe:
// - production: any issue below throws.
// - development/test: same checks run, but issues only log a concise warning
//   (dev boxes routinely lack Cloudflare/Lemon Squeezy/etc keys).
//
// NEVER put a raw secret value into an issue message — only lengths/hosts.

let isProd = process.env.NODE_ENV === "production";

function fingerprint(value: string): string {
  return `len=${value.length}`;
}

function urlHost(value: string): string {
  try {
    return new URL(value).host || "unknown-host";
  } catch {
    return "invalid-url";
  }
}

const shape = {
  // --- Core ---
  DATABASE_URL: z.string().optional(),
  WORKOS_API_KEY: z.string().optional(),
  WORKOS_CLIENT_ID: z.string().optional(),
  WORKOS_COOKIE_PASSWORD: z.string().optional(),
  ACTIVE_WORKSPACE_COOKIE_SECRET: z.string().optional(),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: z.string().optional(),
  WORKOS_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().optional(),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  CLOUDFLARE_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_IMAGES_API_TOKEN: z.string().optional(),
  CLOUDFLARE_IMAGES_ACCOUNT_HASH: z.string().optional(),
  NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH: z.string().optional(),
  LEMONSQUEEZY_API_KEY: z.string().optional(),
  LEMONSQUEEZY_STORE_ID: z.string().optional(),
  LEMONSQUEEZY_WEBHOOK_SECRET: z.string().optional(),
  LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID: z.string().optional(),
  LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID: z.string().optional(),
  LEMONSQUEEZY_TEST_MODE: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  AUTHKIT_DEBUG: z.string().optional(),
  SEED_OWNER_WORKOS_USER_ID: z.string().optional(),
  SEED_OWNER_EMAIL: z.string().optional(),
  SEED_OWNER_NAME: z.string().optional(),
  SEED_OWNER_PASSWORD: z.string().optional(),
  SEED_PORTFOLIO_SLUG: z.string().optional(),
  LEMONSQUEEZY_SIM_URL: z.string().optional(),

  // --- Optional today; promote to REQUIRED_IN_PROD later (one-line move) ---
  WORKFLOW_TARGET_WORLD: z.string().optional(),
  WORKFLOW_POSTGRES_URL: z.string().optional(),
  WORKFLOW_POSTGRES_JOB_PREFIX: z.string().optional(),
  WORKFLOW_POSTGRES_WORKER_CONCURRENCY: z.string().optional(),
  WORKFLOW_POSTGRES_MAX_POOL_SIZE: z.string().optional(),
  WORKOS_COOKIE_NAME: z.string().optional(),
  EMAIL_REPLY_TO: z.string().optional(),
  NEXT_PUBLIC_PORTFOLIO_BASE_DOMAIN: z.string().optional(),
  PAGEVIEW_SALT_SECRET: z.string().optional(),
  BETA_TESTER_ENABLED: z.string().optional(),
  PORT: z.string().optional(),
};

type EnvKey = keyof typeof shape;
type FieldRule = { minLen?: number; https?: boolean };

// Vars required when NODE_ENV==="production". Move a key from the "optional
// today" block above into here (with its rule, `{}` if none) to promote it.
const REQUIRED_IN_PROD: Partial<Record<EnvKey, FieldRule>> = {
  DATABASE_URL: {},
  WORKOS_API_KEY: {},
  WORKOS_CLIENT_ID: {},
  WORKOS_COOKIE_PASSWORD: { minLen: 32 },
  ACTIVE_WORKSPACE_COOKIE_SECRET: { minLen: 32 },
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: { https: true },
  WORKOS_WEBHOOK_SECRET: {},
  NEXT_PUBLIC_APP_URL: { https: true },
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: {},
  TURNSTILE_SECRET_KEY: {},
  CLOUDFLARE_ACCOUNT_ID: {},
  CLOUDFLARE_IMAGES_API_TOKEN: {},
  CLOUDFLARE_IMAGES_ACCOUNT_HASH: {},
  NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH: {},
  LEMONSQUEEZY_API_KEY: {},
  LEMONSQUEEZY_STORE_ID: {},
  LEMONSQUEEZY_WEBHOOK_SECRET: {},
  LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID: {},
  LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID: {},
  RESEND_API_KEY: {},
  EMAIL_FROM: {},
  CRON_SECRET: {},
  WORKFLOW_TARGET_WORLD: {},
  WORKFLOW_POSTGRES_URL: {},
};

const envSchema = z.object(shape).superRefine((data, ctx) => {
  for (const [key, rule] of Object.entries(REQUIRED_IN_PROD) as [EnvKey, FieldRule][]) {
    const val = data[key];
    if (!val) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key}: missing (required in production)`,
      });
      continue;
    }
    if (rule.minLen && val.length < rule.minLen) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key}: too short (${fingerprint(val)}, need >=${rule.minLen} chars)`,
      });
    }
    if (rule.https && !val.startsWith("https://")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key}: must be https (host=${urlHost(val)})`,
      });
    }
  }

  if (data.EMAIL_FROM && data.EMAIL_FROM.includes("onboarding@resend.dev")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["EMAIL_FROM"],
      message: "EMAIL_FROM: must not use the onboarding@resend.dev default",
    });
  }

  // Cross-checks + forbidden vars — prod-only. Several (SEED_OWNER_*,
  // LEMONSQUEEZY_TEST_MODE=true, AUTHKIT_DEBUG=true) are normal in dev, so
  // they must never fire outside production.
  if (isProd) {
    if (
      data.CLOUDFLARE_IMAGES_ACCOUNT_HASH &&
      data.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH &&
      data.CLOUDFLARE_IMAGES_ACCOUNT_HASH !== data.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["CLOUDFLARE_IMAGES_ACCOUNT_HASH"],
        message: "CLOUDFLARE_IMAGES_ACCOUNT_HASH must equal NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH",
      });
    }

    if (data.LEMONSQUEEZY_TEST_MODE !== "false") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["LEMONSQUEEZY_TEST_MODE"],
        message: `LEMONSQUEEZY_TEST_MODE must be the literal "false" in production (current=${JSON.stringify(
          data.LEMONSQUEEZY_TEST_MODE ?? null
        )})`,
      });
    }

    if (data.AUTHKIT_DEBUG === "true") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["AUTHKIT_DEBUG"],
        message: "AUTHKIT_DEBUG must not be true in production",
      });
    }

    if (
      data.WORKFLOW_TARGET_WORLD === "local" ||
      data.WORKFLOW_TARGET_WORLD === "@workflow/world-local"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["WORKFLOW_TARGET_WORLD"],
        message:
          "WORKFLOW_TARGET_WORLD must not be the Local World in production (loses queued checkouts on restart)",
      });
    }

    for (const key of Object.keys(process.env)) {
      const isSeedKey =
        key.startsWith("SEED_OWNER_") ||
        key.startsWith("SUB_EXPIRED_WORKOS_") ||
        key === "SEED_PORTFOLIO_SLUG" ||
        key === "LEMONSQUEEZY_SIM_URL";
      if (isSeedKey && process.env[key]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [key],
          message: `${key} must not be set in production`,
        });
      }
    }
  }
});

export type Env = z.infer<typeof envSchema>;

function formatIssues(issues: z.ZodIssue[]): string {
  return issues.map((issue) => issue.message).join("; ");
}

// Lenient accessor — never parses, never throws at import. Real values are
// only guaranteed valid once `validateEnv()` has been called (see server.ts).
export const env: Env = process.env as unknown as Env;

// Call once at runtime startup (never at module import / build time —
// `next build` runs with NODE_ENV=production on machines that may lack real
// prod secrets, so parsing here must never be an import-time side effect).
export function validateEnv(): void {
  isProd = process.env.NODE_ENV === "production";
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const summary = formatIssues(result.error.issues);
    if (isProd) {
      throw new Error(`Invalid production environment configuration: ${summary}`);
    }
    console.warn(`[env] configuration issue(s) — will throw in production: ${summary}`);
  }
}
