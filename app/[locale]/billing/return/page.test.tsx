import { describe, expect, it, vi } from "vitest";

const requireOrgMock = vi.fn();

vi.mock("next-intl/server", () => ({ setRequestLocale: vi.fn() }));
vi.mock("@/lib/auth/requireOrg", () => ({ requireOrg: (...args: unknown[]) => requireOrgMock(...args) }));
vi.mock("./verification", () => ({ BillingVerification: (props: { returnTo: string }) => <div data-return-to={props.returnTo} /> }));

import BillingReturnPage from "./page";

describe("BillingReturnPage", () => {
  it("allows a gated workspace to reach the verification screen with a safe local return target", async () => {
    requireOrgMock.mockResolvedValue({ workspaceId: "ws_123" });

    const screen = await BillingReturnPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ returnTo: "/inquiries?inquiryId=abc" }),
    });

    expect(requireOrgMock).toHaveBeenCalledWith({ allowDuringOnboarding: true, allowWhenGated: true });
    expect(screen.props.returnTo).toBe("/inquiries?inquiryId=abc");
  });

  it("falls back to Settings and rejects an external return target", async () => {
    requireOrgMock.mockResolvedValue({ workspaceId: "ws_123" });

    const screen = await BillingReturnPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ returnTo: "https://example.invalid" }),
    });

    expect(screen.props.returnTo).toBe("/settings/billing");
  });
});
