/**
 * Lemon Squeezy webhook replay / reconcile tool.
 *
 * Operator utility: re-sends a stored WebhookEvent ledger row's (redacted)
 * payload through the real webhook endpoint, signed with the real webhook
 * secret — exactly like scripts/lemonsqueezy-sim.ts, but sourced from a
 * previously-received event instead of a synthetic one. This reuses the
 * production route's signature verification, dedupe gate, and handler
 * dispatch unchanged; the script itself does not import any handler logic.
 *
 * Usage:
 *   pnpm tsx scripts/replay-lemonsqueezy-event.ts <webhookEventId> --target=<dbHostSubstring> [--url=<endpoint>]
 *
 * --target is mandatory: a substring of the connected DATABASE_URL's host,
 * printed (redacted) on every run, so an operator can't silently replay
 * against the wrong environment's ledger.
 *
 * --url overrides the target webhook endpoint; defaults to
 * LEMONSQUEEZY_SIM_URL or http://localhost:3000/api/webhooks/lemonsqueezy.
 */
import { config as loadEnv } from "dotenv";
import { createHmac } from "node:crypto";
import { fileURLToPath } from "node:url";
import { connectDB } from "@/lib/db/mongoose";
import { WebhookEvent } from "@/lib/db/models";

loadEnv({ path: ".env.local" });
loadEnv();

const DEFAULT_TARGET_URL =
  process.env.LEMONSQUEEZY_SIM_URL ?? "http://localhost:3000/api/webhooks/lemonsqueezy";

export type ReplayResult = { status: number; body: string };
export type ReplayOptions = {
  targetUrl?: string;
  fetchImpl?: typeof fetch;
};

export async function replayEvent(
  webhookEventId: string,
  opts: ReplayOptions = {}
): Promise<ReplayResult> {
  const targetUrl = opts.targetUrl ?? DEFAULT_TARGET_URL;
  const fetchImpl = opts.fetchImpl ?? fetch;

  await connectDB();
  const ledger = await WebhookEvent.findById(webhookEventId);
  if (!ledger) {
    throw new Error(`WebhookEvent ${webhookEventId} not found`);
  }
  if (!ledger.payload) {
    throw new Error(`WebhookEvent ${webhookEventId} has no stored payload to replay`);
  }

  const body = JSON.stringify(ledger.payload);
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? "";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (secret) {
    headers["x-signature"] = createHmac("sha256", secret).update(body).digest("hex");
  }

  const res = await fetchImpl(targetUrl, { method: "POST", headers, body });
  const text = await res.text();
  return { status: res.status, body: text };
}

export type ParsedArgs = {
  webhookEventId: string;
  target?: string;
  url?: string;
};

export function parseArgs(argv: string[]): ParsedArgs {
  const [webhookEventId, ...rest] = argv;
  let target: string | undefined;
  let url: string | undefined;
  for (const arg of rest) {
    if (arg.startsWith("--target=")) target = arg.slice("--target=".length);
    else if (arg.startsWith("--url=")) url = arg.slice("--url=".length);
  }
  return { webhookEventId, target, url };
}

async function main() {
  const { webhookEventId, target, url } = parseArgs(process.argv.slice(2));
  if (!webhookEventId) {
    console.error(
      "Usage: pnpm tsx scripts/replay-lemonsqueezy-event.ts <webhookEventId> --target=<dbHostSubstring> [--url=<endpoint>]"
    );
    process.exit(1);
  }

  const dbUri = process.env.DATABASE_URL;
  if (!dbUri) {
    console.error("Missing DATABASE_URL environment variable");
    process.exit(1);
  }

  try {
    assertTargetGuard(dbUri, target);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  console.log(
    `Replaying WebhookEvent ${webhookEventId} against DB fingerprint ${redactedFingerprint(dbUri)}`
  );

  const result = await replayEvent(webhookEventId, { targetUrl: url });
  console.log(`<- ${result.status} ${result.body}`);
  process.exit(result.status >= 200 && result.status < 300 ? 0 : 1);
}

const isMainModule =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMainModule) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

export function parseDbHost(uri: string): string {
  return new URL(uri).hostname;
}

// Redacted DB target fingerprint — printed before any replay so an operator
// can eyeball which environment they're pointed at without a full connection
// string (credentials, full cluster name) hitting a shared terminal/log.
export function redactedFingerprint(uri: string): string {
  const host = parseDbHost(uri);
  if (host.length <= 4) return "*".repeat(host.length);
  return `${"*".repeat(host.length - 4)}${host.slice(-4)}`;
}

// Guard against dev/prod target confusion: refuse to run unless the operator
// passes --target=<substring> matching the connected DATABASE_URL's host.
// Forces a conscious, explicit confirmation of which environment's ledger is
// about to be read/replayed.
export function assertTargetGuard(uri: string, targetArg: string | undefined): void {
  const fingerprint = redactedFingerprint(uri);
  if (!targetArg) {
    throw new Error(
      `Refusing to replay without --target=<substring>. Pass a substring of the ` +
        `expected DB host to confirm you're pointed at the intended environment ` +
        `(current fingerprint: ${fingerprint}).`
    );
  }
  const host = parseDbHost(uri);
  if (!host.includes(targetArg)) {
    throw new Error(
      `--target="${targetArg}" does not match the connected DB host ` +
        `(fingerprint: ${fingerprint}). Aborting.`
    );
  }
}
