import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { validateEnv } from "./env";

const ORIGINAL_ENV = { ...process.env };

const VALID_PROD_ENV: Record<string, string> = {
  NODE_ENV: "production",
  DATABASE_URL: "mongodb+srv://user:pass@cluster.mongodb.net/db",
  WORKOS_API_KEY: "sk_test_abc",
  WORKOS_CLIENT_ID: "client_abc",
  WORKOS_COOKIE_PASSWORD: "a".repeat(32),
  ACTIVE_WORKSPACE_COOKIE_SECRET: "b".repeat(32),
  NEXT_PUBLIC_WORKOS_REDIRECT_URI: "https://app.example.com/api/auth/callback",
  WORKOS_WEBHOOK_SECRET: "whsec_abc",
  NEXT_PUBLIC_APP_URL: "https://app.example.com",
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: "site_key",
  TURNSTILE_SECRET_KEY: "secret_key",
  CLOUDFLARE_ACCOUNT_ID: "cf_account",
  CLOUDFLARE_IMAGES_API_TOKEN: "cf_token",
  CLOUDFLARE_IMAGES_ACCOUNT_HASH: "hash123",
  NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH: "hash123",
  LEMONSQUEEZY_API_KEY: "ls_key",
  LEMONSQUEEZY_STORE_ID: "12345",
  LEMONSQUEEZY_WEBHOOK_SECRET: "ls_whsec",
  LEMONSQUEEZY_VARIANT_PRO_MONTHLY_ID: "111",
  LEMONSQUEEZY_VARIANT_PRO_YEARLY_ID: "222",
  LEMONSQUEEZY_TEST_MODE: "false",
  RESEND_API_KEY: "re_abc",
  EMAIL_FROM: "Gallurio <hello@gallurio.com>",
  CRON_SECRET: "cron_secret_value",
  WORKFLOW_TARGET_WORLD: "@workflow/world-postgres",
  WORKFLOW_POSTGRES_URL: "postgres://user:pass@host:5432/db",
};

function setEnv(vars: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(vars)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function resetEnv() {
  for (const key of Object.keys(process.env)) {
    delete process.env[key];
  }
  Object.assign(process.env, ORIGINAL_ENV);
}

describe("lib/env", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetEnv();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    resetEnv();
  });

  it("throws in production when a required var is missing", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    delete process.env.DATABASE_URL;

    expect(() => validateEnv()).toThrow(/DATABASE_URL/);
  });

  it("warns instead of throwing in development when required vars are missing", () => {
    resetEnv();
    setEnv({ NODE_ENV: "development" });

    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("passes validation in production with a fully valid config", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);

    expect(() => validateEnv()).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("rejects a too-short cookie secret in production", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    process.env.WORKOS_COOKIE_PASSWORD = "short";

    expect(() => validateEnv()).toThrow(/WORKOS_COOKIE_PASSWORD/);
  });

  it("rejects a non-https URL var in production", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    process.env.NEXT_PUBLIC_APP_URL = "http://app.example.com";

    expect(() => validateEnv()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("rejects mismatched Cloudflare Images account hashes in production", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH = "different-hash";

    expect(() => validateEnv()).toThrow(/CLOUDFLARE_IMAGES_ACCOUNT_HASH/);
  });

  it('rejects LEMONSQUEEZY_TEST_MODE not equal to "false" in production', () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    process.env.LEMONSQUEEZY_TEST_MODE = "true";

    expect(() => validateEnv()).toThrow(/LEMONSQUEEZY_TEST_MODE/);
  });

  it("rejects AUTHKIT_DEBUG=true in production", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    process.env.AUTHKIT_DEBUG = "true";

    expect(() => validateEnv()).toThrow(/AUTHKIT_DEBUG/);
  });

  it("rejects SEED_OWNER_* vars present in production", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    process.env.SEED_OWNER_EMAIL = "seed@example.com";

    expect(() => validateEnv()).toThrow(/SEED_OWNER_EMAIL/);
  });

  it("rejects the Local World as WORKFLOW_TARGET_WORLD in production", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    process.env.WORKFLOW_TARGET_WORLD = "@workflow/world-local";

    expect(() => validateEnv()).toThrow(/WORKFLOW_TARGET_WORLD/);
  });

  it("never includes secret values in the thrown error message", () => {
    resetEnv();
    setEnv(VALID_PROD_ENV);
    const secretValue = "short-secret";
    process.env.WORKOS_COOKIE_PASSWORD = secretValue;

    let caught: unknown;
    try {
      validateEnv();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).not.toContain(secretValue);
  });
});
