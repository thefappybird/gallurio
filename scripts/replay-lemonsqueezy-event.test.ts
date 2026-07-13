import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { WebhookEvent } from "@/lib/db/models";
import {
  parseDbHost,
  redactedFingerprint,
  assertTargetGuard,
  replayEvent,
  parseArgs,
} from "./replay-lemonsqueezy-event";

describe("parseDbHost", () => {
  it("extracts the hostname from a mongodb+srv connection string", () => {
    expect(parseDbHost("mongodb+srv://user:pass@cluster0.abcde.mongodb.net/mydb")).toBe(
      "cluster0.abcde.mongodb.net"
    );
  });
});

describe("redactedFingerprint", () => {
  it("masks all but the last 4 characters of the host", () => {
    const uri = "mongodb+srv://user:pass@cluster0.abcde.mongodb.net/mydb";
    const fp = redactedFingerprint(uri);
    expect(fp.endsWith(".net")).toBe(true);
    expect(fp).not.toContain("cluster0.abcde.mongodb");
  });
});

describe("assertTargetGuard", () => {
  it("throws when no --target is given", () => {
    const uri = "mongodb://localhost:27017/dev";
    expect(() => assertTargetGuard(uri, undefined)).toThrow(/--target/);
  });

  it("throws when --target does not match the connected host", () => {
    const uri = "mongodb+srv://user:pass@prod-cluster.abcde.mongodb.net/mydb";
    expect(() => assertTargetGuard(uri, "localhost")).toThrow(/does not match/);
  });

  it("does not throw when --target matches a substring of the connected host", () => {
    const uri = "mongodb://localhost:27017/dev";
    expect(() => assertTargetGuard(uri, "localhost")).not.toThrow();
  });
});

describe("replayEvent", () => {
  beforeAll(async () => {
    await startInMemoryMongo();
  }, 120_000);

  afterAll(async () => {
    await stopInMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it("throws when the WebhookEvent row does not exist", async () => {
    const missingId = new Types.ObjectId().toString();
    await expect(
      replayEvent(missingId, { targetUrl: "http://test/webhook", fetchImpl: async () => new Response() })
    ).rejects.toThrow(/not found/i);
  });

  it("throws when the WebhookEvent row has no stored payload", async () => {
    const ledger = await WebhookEvent.create({
      eventKey: "hash_no_payload",
      eventName: "subscription_created",
      resourceId: "sub_no_payload",
    });

    await expect(
      replayEvent(ledger._id.toString(), {
        targetUrl: "http://test/webhook",
        fetchImpl: async () => new Response(),
      })
    ).rejects.toThrow(/no stored payload/i);
  });

  it("signs the stored payload and POSTs identical body+signature on repeated replays (idempotent resend)", async () => {
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = "whsec_replay_test";

    const ledger = await WebhookEvent.create({
      eventKey: "hash_replay_signed",
      eventName: "subscription_created",
      resourceId: "sub_replay_signed",
      status: "failed",
      payload: {
        meta: { event_name: "subscription_created", custom_data: { workspaceId: "ws_1" } },
        data: { id: "sub_replay_signed", attributes: { status: "active" } },
      },
    });

    const calls: { url: string; body: string; signature: string | null }[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push({
        url: String(url),
        body: String(init?.body ?? ""),
        signature: (init?.headers as Record<string, string>)["x-signature"] ?? null,
      });
      return new Response(JSON.stringify({ received: true }), { status: 200 });
    }) as typeof fetch;

    const first = await replayEvent(ledger._id.toString(), {
      targetUrl: "http://test/webhook",
      fetchImpl,
    });
    const second = await replayEvent(ledger._id.toString(), {
      targetUrl: "http://test/webhook",
      fetchImpl,
    });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(calls).toHaveLength(2);
    expect(calls[0].body).toBe(calls[1].body);
    expect(calls[0].signature).toBe(calls[1].signature);
    expect(calls[0].signature).not.toBeNull();
  });
});

describe("parseArgs", () => {
  it("parses the ledger id, --target, and --url flags", () => {
    const parsed = parseArgs(["68abc123", "--target=localhost", "--url=http://x/webhook"]);
    expect(parsed).toEqual({
      webhookEventId: "68abc123",
      target: "localhost",
      url: "http://x/webhook",
    });
  });
});
