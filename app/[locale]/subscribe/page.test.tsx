/**
 * SubscribePage — server component gating tests.
 *
 * requireOrg/getProPricing/next-intl server helpers are mocked so the page
 * can be called directly as an async function. SubscribePanel is stubbed to
 * isolate page-level rendering (owner vs. staff branch, and the props passed
 * through to the panel).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn().mockResolvedValue((key: string) => key),
}));

vi.mock("@/lib/lemonsqueezy/pricing", () => ({
  getProPricing: vi.fn().mockResolvedValue({ currency: "PHP", monthly: 250, yearly: 2500 }),
}));

const requireOrgMock = vi.fn();
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: (...args: unknown[]) => requireOrgMock(...args),
}));

const userFindOneMock = vi.fn();
vi.mock("@/lib/db/models", () => ({
  User: { findOne: (...args: unknown[]) => userFindOneMock(...args) },
}));

vi.mock("./_panel", () => ({
  SubscribePanel: (props: { returnTo?: string }) => (
    <div data-testid="subscribe-panel" data-return-to={props.returnTo ?? ""} />
  ),
}));

// signOutAction is a server action; stub it to avoid server-only imports
// (next/headers, @workos-inc/authkit-nextjs) pulled in via SignOutLink.
vi.mock("@/lib/auth/signOut", () => ({
  signOutAction: vi.fn(),
}));

import SubscribePage from "./page";

const WORKSPACE_STUB = { _id: "ws_1", plan: "free", everSubscribed: true };

function mockAsOwner() {
  requireOrgMock.mockResolvedValue({ role: "owner", workspace: WORKSPACE_STUB });
}

function mockAsStaff() {
  requireOrgMock.mockResolvedValue({ role: "staff", workspace: WORKSPACE_STUB });
}

function makeParams() {
  return Promise.resolve({ locale: "en" });
}

function makeSearchParams(returnTo?: string) {
  return Promise.resolve({ returnTo });
}

beforeEach(() => {
  vi.clearAllMocks();
  userFindOneMock.mockReturnValue({ lean: vi.fn().mockResolvedValue({ betaParticipation: { recordedAt: null } }) });
});

describe("SubscribePage — owner", () => {
  it("renders the SubscribePanel checkout CTA", async () => {
    mockAsOwner();
    const el = await SubscribePage({ params: makeParams(), searchParams: makeSearchParams() });
    render(el);

    expect(screen.getByTestId("subscribe-panel")).toBeInTheDocument();
    expect(screen.getByText("owner.title")).toBeInTheDocument();
    expect(screen.queryByText("staff.title")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "logout" })).toBeInTheDocument();
  });

  it("passes returnTo through to SubscribePanel when present", async () => {
    mockAsOwner();
    const el = await SubscribePage({
      params: makeParams(),
      searchParams: makeSearchParams("/inquiries?inquiryId=abc123"),
    });
    render(el);

    expect(screen.getByTestId("subscribe-panel")).toHaveAttribute(
      "data-return-to",
      "/inquiries?inquiryId=abc123"
    );
  });

  it("requires org with allowDuringOnboarding + allowWhenGated", async () => {
    mockAsOwner();
    await SubscribePage({ params: makeParams(), searchParams: makeSearchParams() });

    expect(requireOrgMock).toHaveBeenCalledWith({
      allowDuringOnboarding: true,
      allowWhenGated: true,
    });
  });
});

describe("SubscribePage — staff", () => {
  it("renders the read-only message and no SubscribePanel", async () => {
    mockAsStaff();
    const el = await SubscribePage({ params: makeParams(), searchParams: makeSearchParams() });
    render(el);

    expect(screen.getByText("staff.title")).toBeInTheDocument();
    expect(screen.getByText("staff.description")).toBeInTheDocument();
    expect(screen.queryByTestId("subscribe-panel")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "logout" })).toBeInTheDocument();
  });
});
