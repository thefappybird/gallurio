import { beforeEach, describe, expect, it, vi } from "vitest";

type MockResponse = { ok: boolean; status: number };

const directUploadPost = vi.fn<(req: Request) => Promise<MockResponse>>();

vi.mock("../../images/direct-upload/route", () => ({
  POST: (req: Request) => directUploadPost(req),
}));

import { POST, runtime } from "./route";

beforeEach(() => {
  directUploadPost.mockReset();
});

describe("POST /api/uploads/sign", () => {
  it("declares the node runtime", () => {
    expect(runtime).toBe("nodejs");
  });

  it("forwards requests to the direct upload handler", async () => {
    const req = new Request("https://example.com/api/uploads/sign", { method: "POST" });
    const res = { ok: true, status: 200 };
    directUploadPost.mockResolvedValueOnce(res);

    await expect(POST(req)).resolves.toBe(res);
    expect(directUploadPost).toHaveBeenCalledWith(req);
  });
});
