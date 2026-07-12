import "server-only";
import { z } from "zod";

// Fail-fast production environment validation.
//
// - production: any issue below throws at import time (server.ts imports this
//   first, so a bad prod config never reaches `next().prepare()`).
// - development/test: same checks run, but issues only log a concise warning
//   (dev boxes routinely lack Cloudflare/Lemon Squeezy/etc keys).
//
// NEVER put a raw secret value into an issue message — only lengths/hosts.

const isProd = process.env.NODE_ENV === "production";

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
  // WORKFLOW_TARGET_WORLD / WORKFLOW_POSTGRES_URL become required once the
  // Workflow-World task lands.
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

    for (const key of Object.keys(process.env)) {
      const isSeedKey = key.startsWith("SEED_OWNER_") || key === "SEED_PORTFOLIO_SLUG" || key === "LEMONSQUEEZY_SIM_URL";
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

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const summary = formatIssues(result.error.issues);
  if (isProd) {
    throw new Error(`Invalid production environment configuration: ${summary}`);
  }
  console.warn(`[env] configuration issue(s) — will throw in production: ${summary}`);
}

export const env: Env = result.success ? result.data : (process.env as unknown as Env);
