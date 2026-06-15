import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";

type MockResp = { body: unknown; status: number };

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    NextResponse: {
      json: (body: unknown, init?: ResponseInit): MockResp => ({
        body,
        status: init?.status ?? 200,
      }),
    },
  };
});

let mockDirectUpload: { imageId: string; uploadURL: string } | null = null;
vi.mock("@/lib/storage/cloudflareImages", () => ({
  requestDirectUpload: async (_workspaceId: string, _subfolder?: string) => {
    if (!mockDirectUpload) throw new Error("CF error");
    return mockDirectUpload;
  },
}));

let mockCtx: { workspace: { _id: Types.ObjectId }; role: string } | null = null;
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: async () => {
    if (!mockCtx) throw Object.assign(new Error("Unauthorized"), { status: 401 });
    return mockCtx;
  },
}));

import { POST } from "./route";

function makeReq(body: unknown): Request {
  return { json: async () => body } as unknown as Request;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCtx = { workspace: { _id: new Types.ObjectId() }, role: "owner" };
  mockDirectUpload = { imageId: "img_abc", uploadURL: "https://upload.cf.test/once/abc" };
});

describe("POST /api/images/direct-upload", () => {
  it("returns imageId and uploadURL for a valid request", async () => {
    const res = (await POST(makeReq({ subfolder: "gallery" }))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ imageId: "img_abc", uploadURL: "https://upload.cf.test/once/abc" });
  });

  it("accepts a request with no body (subfolder defaults)", async () => {
    const res = (await POST(makeReq({}))) as unknown as MockResp;
    expect(res.status).toBe(200);
    expect((res.body as { imageId: string }).imageId).toBe("img_abc");
  });

  it("rejects an invalid subfolder with 400", async () => {
    const res = (await POST(makeReq({ subfolder: "../../evil" }))) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("rejects a subfolder over 40 chars with 400", async () => {
    const res = (await POST(makeReq({ subfolder: "a".repeat(41) }))) as unknown as MockResp;
    expect(res.status).toBe(400);
  });

  it("propagates CF errors as thrown exceptions", async () => {
    mockDirectUpload = null;
    await expect(POST(makeReq({}))).rejects.toThrow("CF error");
  });
});
