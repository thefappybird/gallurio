import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import { startInMemoryMongo, stopInMemoryMongo, clearCollections } from "@/test-utils/mongo";
import { WebhookEvent } from "@/lib/db/models";

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

process.env.RESEND_WEBHOOK_SECRET = "whsec_dGVzdHNlY3JldGJ5dGVzMTIzNDU2Nzg5MA==";

function sign(secret: string, svixId: string, svixTimestamp: string, rawBody: string): string {
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const mac = createHmac("sha256", secretBytes)
    .update(`${svixId}.${svixTimestamp}.${rawBody}`)
    .digest("base64");
  return `v1,${mac}`;
}

function makeReq(
  body: Record<string, unknown>,
  opts: { svixId?: string | null; badSignature?: boolean; omitSignature?: boolean } = {}
) {
  const rawBody = JSON.stringify(body);
  const svixId = opts.svixId === undefined ? `msg_${Math.random().toString(36).slice(2)}` : opts.svixId;
  const svixTimestamp = "1752451200";
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (svixId) headers["svix-id"] = svixId;
  headers["svix-timestamp"] = svixTimestamp;
  if (!opts.omitSignature) {
    headers["svix-signature"] = opts.badSignature
      ? "v1,bm90YXJlYWxzaWduYXR1cmU="
      : sign(process.env.RESEND_WEBHOOK_SECRET!, svixId ?? "", svixTimestamp, rawBody);
  }
  return new Request("http://test/api/webhooks/resend", {
    method: "POST",
    headers,
    body: rawBody,
  });
}

async function loadRoute() {
  return import("./route");
}

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
});

describe("resend webhook — valid signature", () => {
  it("accepts a validly signed request and records a processed WebhookEvent row", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({
        type: "email.delivered",
        created_at: "2026-07-14T00:00:00.000Z",
        data: { email_id: "em_valid_sig" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ received: true });

    const rows = await WebhookEvent.find({ provider: "resend" }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("processed");
    expect(rows[0].eventName).toBe("email.delivered");
  });
});

describe("resend webhook — invalid signature", () => {
  it("returns 401 and writes nothing when the signature is wrong", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeReq(
        { type: "email.delivered", created_at: "2026-07-14T00:00:00.000Z", data: {} },
        { badSignature: true }
      )
    );

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Invalid signature" });

    const rows = await WebhookEvent.find({ provider: "resend" }).lean();
    expect(rows).toHaveLength(0);
  });

  it("returns 401 when the svix-signature header is missing", async () => {
    const { POST } = await loadRoute();
    const res = await POST(
      makeReq(
        { type: "email.delivered", created_at: "2026-07-14T00:00:00.000Z", data: {} },
        { omitSignature: true }
      )
    );

    expect(res.status).toBe(401);
    const rows = await WebhookEvent.find({ provider: "resend" }).lean();
    expect(rows).toHaveLength(0);
  });
});

describe("resend webhook — dedupe via svix-id", () => {
  it("acks a redelivered event with the same svix-id as deduped, without reprocessing", async () => {
    const { POST } = await loadRoute();
    const svixId = "msg_dedupe_test";
    const body = {
      type: "email.delivered",
      created_at: "2026-07-14T00:00:00.000Z",
      data: { email_id: "em_dedupe" },
    };

    const first = await POST(makeReq(body, { svixId }));
    expect((await first.json()).deduped).toBeUndefined();

    const second = await POST(makeReq(body, { svixId }));
    expect(await second.json()).toEqual({ received: true, deduped: true });

    const rows = await WebhookEvent.find({ provider: "resend", eventKey: svixId }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("processed");
  });
});

describe("resend webhook — email.bounced", () => {
  it("logs a redacted warning that never contains the recipient address", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recipient = "victim-address@example.com";

    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({
        type: "email.bounced",
        created_at: "2026-07-14T00:00:00.000Z",
        data: { email_id: "em_bounced", to: [recipient], from: "Gallurio <hi@gallurio.com>" },
      })
    );

    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
    const loggedText = warnSpy.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(loggedText).not.toContain(recipient);
    expect(loggedText).toContain("email.bounced");

    warnSpy.mockRestore();
  });
});

describe("resend webhook — handler exception returns a retryable 5xx", () => {
  it("returns 500 and marks the ledger row failed when the handler throws unexpectedly", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {
      throw new Error("log sink exploded");
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({
        type: "email.bounced",
        created_at: "2026-07-14T00:00:00.000Z",
        data: { email_id: "em_throws" },
      })
    );

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ received: false, error: "handler failed" });

    const rows = await WebhookEvent.find({ provider: "resend" }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("failed");
    expect(rows[0].failedAt).toBeInstanceOf(Date);
    expect(rows[0].lastError).toContain("log sink exploded");

    warnSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe("resend webhook — unmodelled event types", () => {
  it("acks email.delivery_delayed with 200 and no bounce/complaint log", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({
        type: "email.delivery_delayed",
        created_at: "2026-07-14T00:00:00.000Z",
        data: { email_id: "em_delayed" },
      })
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ received: true });
    expect(warnSpy).not.toHaveBeenCalled();

    const rows = await WebhookEvent.find({ provider: "resend" }).lean();
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("processed");

    warnSpy.mockRestore();
  });
});

describe("resend webhook — email.complained", () => {
  it("logs a redacted warning that never contains the recipient address", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const recipient = "complainer@example.com";

    const { POST } = await loadRoute();
    const res = await POST(
      makeReq({
        type: "email.complained",
        created_at: "2026-07-14T00:00:00.000Z",
        data: { email_id: "em_complained", to: [recipient] },
      })
    );

    expect(res.status).toBe(200);
    expect(warnSpy).toHaveBeenCalled();
    const loggedText = warnSpy.mock.calls.map((c) => JSON.stringify(c)).join(" ");
    expect(loggedText).not.toContain(recipient);
    expect(loggedText).toContain("email.complained");

    warnSpy.mockRestore();
  });
});
