import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
}));

import { workos } from "@/lib/workos";
import { sendEmail } from "@/lib/email/send";

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

beforeEach(() => {
  vi.clearAllMocks();
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
      event: "email_verification.created",
      data: { id: "ev_1", userId: "user_1", email: "test@example.com" },
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

describe("WorkOS webhook — handler throws but route returns 200", () => {
  it("returns 200 and logs the error even when the dispatch block throws", async () => {
    mockConstructEvent.mockResolvedValue({
      event: "unknown.event_that_causes_error",
      data: {},
    } as never);

    // Force the dispatch block to actually throw: the default branch calls
    // console.log, so making console.log throw exercises the outer try/catch
    // (the real contract — a handler failure must still ack 200).
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {
      throw new Error("boom");
    });
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { POST } = await loadRoute();
    const res = await POST(makeReq());

    // Verified → handler threw → still 200, and the failure was logged via console.error.
    expect(res.status).toBe(200);
    expect(consoleErrorSpy).toHaveBeenCalledOnce();
    expect(consoleErrorSpy.mock.calls[0][0]).toContain("unknown.event_that_causes_error");

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
  });
});
