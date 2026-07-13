import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  startInMemoryMongo,
  stopInMemoryMongo,
  clearCollections,
} from "@/test-utils/mongo";

// ---------------------------------------------------------------------------
// Module mock — declared before import so vi.mock hoisting applies.
// We mock the singleton WorkOS client so constructEvent is a controllable spy.
// ---------------------------------------------------------------------------

vi.mock("@/lib/workos", () => ({
  workos: {
    webhooks: {
      constructEvent: vi.fn(),
    },
    userManagement: {
      getEmailVerification: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email/send", () => ({
  sendEmail: vi.fn().mockResolvedValue({ ok: true, id: "msg_test" }),
  logEmailFailure: vi.fn(),
}));

vi.mock("@/lib/db/mongoose", () => ({
  connectDB: async () => undefined,
}));

import { workos } from "@/lib/workos";
import { sendEmail } from "@/lib/email/send";
import { EMAIL_COPY } from "@/lib/email/messages";
import { WebhookEvent } from "@/lib/db/models";

const mockConstructEvent = vi.mocked(workos.webhooks.constructEvent);
const mockGetEmailVerification = vi.mocked(workos.userManagement.getEmailVerification);
const mockSendEmail = vi.mocked(sendEmail);

// ---------------------------------------------------------------------------
// Request builder
// ---------------------------------------------------------------------------

function makeReq(opts?: {
  body?: string;
  sigHeader?: string | null;
}) {
  const body = opts?.body ?? "<raw-body>";
  const sigHeader = opts?.sigHeader === undefined ? "t=123,v1=abc" : opts.sigHeader;
  const headers: Record<string, string> = {
    "content-type": "text/plain",
  };
  if (sigHeader !== null) {
    headers["workos-signature"] = sigHeader;
  }
  return new Request("http://localhost/api/webhooks/workos", {
    method: "POST",
    body,
    headers,
  });
}

async function loadRoute() {
  return import("./route");
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

beforeAll(async () => {
  await startInMemoryMongo();
}, 120_000);

afterAll(async () => {
  await stopInMemoryMongo();
});

beforeEach(async () => {
  await clearCollections();
  vi.clearAllMocks();
  // clearAllMocks resets call history but not a persistent mockResolvedValue
  // override — re-establish the default success return so a prior test's
  // failure override (e.g. mockSendEmail.mockResolvedValue({ ok: false })
  // ) can't leak into unrelated tests.
  mockSendEmail.mockResolvedValue({ ok: true, id: "msg_test" });
  process.env.WORKOS_WEBHOOK_SECRET = "test-webhook-secret";
});

afterEach(() => {
  delete process.env.WORKOS_WEBHOOK_SECRET;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WorkOS webhook — missing signature header → 400", () => {
  it("returns 400 and does not call constructEvent when the WorkOS-Signature header is absent", async () => {
    const { POST } = await loadRoute();
    const res = await POST(makeReq({ sigHeader: null }));

    expect(res.status).toBe(400);
    expect(mockConstructEvent).not.toHaveBeenCalled();
  });
});

describe("WorkOS webhook — invalid signature → 400", () => {
  it("returns 400 and does not invoke any handler when constructEvent throws", async () => {
    mockConstructEvent.mockRejectedValue(
      new Error("SignatureVerificationException: invalid signature")
    );

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(400);
    // constructEvent must have been called with the raw body string
    expect(mockConstructEvent).toHaveBeenCalledOnce();
    expect(mockConstructEvent).toHaveBeenCalledWith(
      expect.objectContaining({ payload: "<raw-body>" })
    );
  });
});

describe("WorkOS webhook — valid signature → 200", () => {
  it("returns 200 when constructEvent resolves with a valid event", async () => {
    mockConstructEvent.mockResolvedValue({
      id: "wevt_valid_1",
      event: "email_verification.created",
      data: { id: "ev_1", userId: "user_1", email: "test@example.com" },
    } as never);
    mockGetEmailVerification.mockResolvedValue({
      id: "ev_1",
      userId: "user_1",
      email: "test@example.com",
      code: "000000",
      expiresAt: "2099-01-01T00:00:00.000Z",
    } as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ body: '{"type":"email_verification.created"}' }));

    expect(res.status).toBe(200);
    expect(mockConstructEvent).toHaveBeenCalledOnce();
    // Verify that constructEvent received the RAW body string — not parsed JSON
    expect(mockConstructEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: '{"type":"email_verification.created"}',
        sigHeader: "t=123,v1=abc",
        secret: "test-webhook-secret",
      })
    );
  });
});

describe("WorkOS webhook — handler throws → retryable 5xx, ledger marked failed", () => {
  it("returns 500 and logs the error when the dispatch block throws (so WorkOS redelivers)", async () => {
    mockConstructEvent.mockResolvedValue({
      id: "wevt_unknown_1",
      event: "unknown.event_that_causes_error",
      data: {},
    } as never);

    // Force the dispatch block to actually throw: the default branch calls
    // console.log, so making console.log throw exercises the outer try/catch
    // (the real contract — a handler failure returns a retryable 5xx, never
    // an ack 200, so WorkOS redelivers).
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("boom");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    // Verified → handler threw → retryable 500, and the failure was logged via console.error.
    expect(res.status).toBe(500);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("unknown.event_that_causes_error");

    const row = await WebhookEvent.findOne({ eventKey: "wevt_unknown_1" }).lean();
    expect(row?.status).toBe("failed");

    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe("WorkOS webhook — email_verification.created → branded email sent", () => {
  it("fetches the verification, renders a branded email containing the code, and sends it", async () => {
    mockConstructEvent.mockResolvedValue({
      event: "email_verification.created",
      data: { id: "emv_abc123", userId: "user_xyz", email: "new@user.test" },
    } as never);

    mockGetEmailVerification.mockResolvedValue({
      id: "emv_abc123",
      userId: "user_xyz",
      email: "new@user.test",
      code: "123456",
      expiresAt: "2099-01-01T00:00:00.000Z",
    } as never);

    const { POST } = await loadRoute();
    const res = await POST(makeReq({ body: '{"event":"email_verification.created"}' }));

    expect(res.status).toBe(200);

    // Fetched the verification record by id
    expect(mockGetEmailVerification).toHaveBeenCalledOnce();
    expect(mockGetEmailVerification).toHaveBeenCalledWith("emv_abc123");

    // Sent email to the verification recipient
    expect(mockSendEmail).toHaveBeenCalledOnce();
    const sendArgs = mockSendEmail.mock.calls[0][0];
    expect(sendArgs.to).toBe("new@user.test");
    expect(sendArgs.subject).toBe("Verify your email - Gallurio");
    // The rendered html must contain the verification code
    expect(sendArgs.html).toContain("123456");
    // Plain text must also carry the code
    expect(sendArgs.text).toContain("123456");
    // The codeLabel must appear in the rendered html (was a dead field before the fix)
    expect(sendArgs.html).toContain(EMAIL_COPY.verification.en.codeLabel);
  });

  it("returns a retryable 5xx (not 200) when sendEmail fails, so WorkOS redelivers and the mail is retried", async () => {
    mockConstructEvent.mockResolvedValue({
      id: "wevt_mailfail_1",
      event: "email_verification.created",
      data: { id: "emv_mailfail", userId: "user_2", email: "mailfail@user.test" },
    } as never);
    mockGetEmailVerification.mockResolvedValue({
      id: "emv_mailfail",
      userId: "user_2",
      email: "mailfail@user.test",
      code: "333333",
      expiresAt: "2099-01-01T00:00:00.000Z",
    } as never);
    mockSendEmail.mockResolvedValue({ ok: false, error: "resend_500" });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    expect(res.status).toBe(500);
    const row = await WebhookEvent.findOne({ eventKey: "wevt_mailfail_1" }).lean();
    expect(row?.status).toBe("failed");
  });
});

describe("WorkOS webhook — dedupe via WebhookEvent ledger", () => {
  it("dedupes an identical redelivered event — single WebhookEvent row, ack carries deduped:true", async () => {
    mockConstructEvent.mockResolvedValue({
      id: "wevt_dedupe_1",
      event: "email_verification.created",
      data: { id: "emv_dedupe1", userId: "user_1", email: "test@example.com" },
    } as never);
    mockGetEmailVerification.mockResolvedValue({
      id: "emv_dedupe1",
      userId: "user_1",
      email: "test@example.com",
      code: "111111",
      expiresAt: "2099-01-01T00:00:00.000Z",
    } as never);

    const { POST } = await loadRoute();
    const first = await POST(makeReq());
    expect(first.status).toBe(200);
    expect((await first.json()).deduped).toBeUndefined();

    const second = await POST(makeReq());
    expect(second.status).toBe(200);
    expect(await second.json()).toEqual({ received: true, deduped: true });

    const rows = await WebhookEvent.find({}).lean();
    expect(rows).toHaveLength(1);
    expect(mockSendEmail).toHaveBeenCalledOnce();
  });

  it("returns a retryable 5xx and marks the ledger row failed when the handler throws, and reprocesses on redelivery", async () => {
    mockConstructEvent.mockResolvedValue({
      id: "wevt_fail_1",
      event: "email_verification.created",
      data: { id: "emv_fail1", userId: "user_1", email: "test@example.com" },
    } as never);
    mockGetEmailVerification.mockRejectedValueOnce(new Error("workos api down"));
    mockGetEmailVerification.mockResolvedValueOnce({
      id: "emv_fail1",
      userId: "user_1",
      email: "test@example.com",
      code: "222222",
      expiresAt: "2099-01-01T00:00:00.000Z",
    } as never);

    const { POST } = await loadRoute();

    const first = await POST(makeReq());
    expect(first.status).toBe(500);
    const firstRow = await WebhookEvent.findOne({ eventKey: "wevt_fail_1" }).lean();
    expect(firstRow?.status).toBe("failed");

    // Redelivery: dedupe gate lets it through again (status !== "processed"),
    // handler now succeeds, ledger flips to processed.
    const second = await POST(makeReq());
    expect(second.status).toBe(200);
    const secondRow = await WebhookEvent.findOne({ eventKey: "wevt_fail_1" }).lean();
    expect(secondRow?.status).toBe("processed");

    const rows = await WebhookEvent.find({ eventKey: "wevt_fail_1" }).lean();
    expect(rows).toHaveLength(1);
  });
});
