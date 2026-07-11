import { describe, it, expect, vi, beforeEach } from "vitest";

// redirect() in real Next.js throws NEXT_REDIRECT to halt execution — replicate
// that here so code after a redirect() call in the page never runs.
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: vi.fn(),
}));

import { redirect } from "next/navigation";
import { requireOrg } from "@/lib/auth/requireOrg";
import InquiryRedirectPage from "./page";

const mockRedirect = vi.mocked(redirect);
const mockRequireOrg = vi.mocked(requireOrg);

beforeEach(() => {
  vi.clearAllMocks();
  mockRedirect.mockImplementation((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  });
});

describe("InquiryRedirectPage", () => {
  it("redirects to /inquiries when inquiryId is missing", async () => {
    await expect(
      InquiryRedirectPage({ searchParams: Promise.resolve({}) })
    ).rejects.toThrow("REDIRECT:/inquiries");

    expect(mockRequireOrg).not.toHaveBeenCalled();
  });

  it("redirects to the inquiry modal path for an active (non-gated) workspace", async () => {
    mockRequireOrg.mockResolvedValue({
      workspace: { plan: "pro", everSubscribed: true },
    } as never);

    await expect(
      InquiryRedirectPage({ searchParams: Promise.resolve({ inquiryId: "abc123" }) })
    ).rejects.toThrow("REDIRECT:/inquiries?inquiryId=abc123");

    expect(mockRequireOrg).toHaveBeenCalledWith(
      expect.objectContaining({ allowWhenGated: true })
    );
  });

  it("redirects to /subscribe with a returnTo when the workspace is gated", async () => {
    mockRequireOrg.mockResolvedValue({
      workspace: { plan: "free", everSubscribed: true },
    } as never);

    await expect(
      InquiryRedirectPage({ searchParams: Promise.resolve({ inquiryId: "abc123" }) })
    ).rejects.toThrow(
      `REDIRECT:/subscribe?returnTo=${encodeURIComponent("/inquiries?inquiryId=abc123")}`
    );
  });
});
