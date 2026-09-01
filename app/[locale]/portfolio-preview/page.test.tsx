import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("notFound");
  }),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    if (typeof arg === "string") {
      return (key: string) => `en:${arg}:${key}`;
    }
    const locale = arg?.locale ?? "en";
    const namespace = arg?.namespace;
    return (key: string) => `${locale}:${namespace}:${key}`;
  }),
}));

const requireOrg = vi.fn();
vi.mock("@/lib/auth/requireOrg", () => ({
  requireOrg: () => requireOrg(),
}));

const { portfolioDraftFindOne } = vi.hoisted(() => ({
  portfolioDraftFindOne: vi.fn(),
}));
vi.mock("@/lib/db/models", () => ({
  PortfolioDraft: { findOne: portfolioDraftFindOne },
}));

vi.mock("@/lib/page-builder/resolveBrandKit", () => ({
  resolveBrandKit: vi.fn(() => ({ cssVars: {}, className: "preview-theme" })),
}));

vi.mock("@/lib/i18n/localeForCountry", () => ({
  resolvePublicChromeLocale: vi.fn(() => "en"),
}));

vi.mock("@/lib/page-builder/serverContext", () => ({
  buildRenderWorkspace: vi.fn((workspace) => ({ slug: workspace.slug })),
}));

vi.mock("@/app/(public)/w/[orgSlug]/_components/buildContactLabels", () => ({
  buildContactLabels: vi.fn((t: (key: string) => string) => ({
    title: t("title"),
    description: t("description"),
    close: t("close"),
    confirmTitle: t("confirmTitle"),
    confirmBody: t("confirmBody"),
    confirmClose: t("confirmClose"),
    form: { name: t("name") },
  })),
}));

vi.mock("@/app/(public)/w/[orgSlug]/_components/PortfolioHeader", () => ({
  PortfolioHeader: ({
    labels,
    config,
    activePath,
  }: {
    labels: { home: string };
    config: { brandText?: string } | null;
    activePath?: string;
  }) => (
    <div>
      <div data-testid="header-home">{labels.home}</div>
      <div data-testid="header-brand">{config?.brandText ?? ""}</div>
      <div data-testid="header-active-path">{activePath ?? ""}</div>
    </div>
  ),
}));

vi.mock("./_components/PreviewContactCard", () => ({
  PreviewContactCard: ({
    title,
    description,
    labels,
  }: {
    title: string;
    description?: string;
    labels: Record<string, string>;
  }) => (
    <div>
      <div>{title}</div>
      <div>{description}</div>
      <div data-testid="contact-label">{labels.name}</div>
    </div>
  ),
}));

vi.mock("./_components/PreviewClient", () => ({
  PreviewClient: ({ zone, slug, workspace, fallbackData, allowBrowserRecovery }: {
    zone: string;
    slug: string;
    workspace: { chrome?: { navigation?: { activePath?: string; labels?: { home?: string } } } };
    fallbackData: { content?: Array<{ props?: { id?: string; headline?: string; config?: { brandText?: string } } }> };
    allowBrowserRecovery?: boolean;
  }) => (
    <div data-testid={`preview-client-${zone}`} data-recovery={String(Boolean(allowBrowserRecovery))}>
      {zone}:{slug}
      <div data-testid={`fallback-${zone}`}>
        {fallbackData.content?.[0]?.props?.id ?? fallbackData.content?.[0]?.props?.headline ?? ""}
      </div>
      {zone === "navigation" && (
        <>
          <div data-testid="header-home">{workspace.chrome?.navigation?.labels?.home}</div>
          <div data-testid="header-brand">{fallbackData.content?.[0]?.props?.config?.brandText}</div>
          <div data-testid="header-active-path">{workspace.chrome?.navigation?.activePath}</div>
        </>
      )}
    </div>
  ),
}));

import PortfolioPreviewPage from "./page";

describe("PortfolioPreviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    portfolioDraftFindOne.mockReturnValue({ lean: vi.fn(async () => null) });
    requireOrg.mockResolvedValue({
      role: "owner",
      workspace: {
        _id: "workspace-1",
        slug: "studio-aurora",
        name: "Studio Aurora",
        publicPage: {
          contact: { title: "DB title", description: "DB description" },
          header: { brandText: "DB brand" },
          data: {
            home: { content: [{ type: "Hero", props: { headline: "DB Hero" } }], root: {} },
          },
          brandKit: null,
          formLocale: "",
        },
      },
    });
  });

  it("renders PreviewClient for home zone with workspace slug", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "home" }),
    });

    render(page);

    const client = screen.getByTestId("preview-client-home");
    expect(client).toHaveTextContent("home:studio-aurora");
    expect(screen.getByTestId("header-active-path")).toHaveTextContent("/en/portfolio-preview");
  });

  it("renders PreviewClient for gallery zone with correct active path", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "gallery" }),
    });

    render(page);

    const client = screen.getByTestId("preview-client-gallery");
    expect(client).toHaveTextContent("gallery:studio-aurora");
    expect(screen.getByTestId("header-active-path")).toHaveTextContent("zone=gallery");
  });

  it("renders contact zone from DB values (no draft param)", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "contact" }),
    });

    render(page);

    expect(screen.getByText("DB title")).toBeInTheDocument();
    expect(screen.getByText("DB description")).toBeInTheDocument();
    expect(screen.getByTestId("contact-label")).toHaveTextContent("en:publicPage.inquiryForm:name");
    expect(screen.getByTestId("header-home")).toHaveTextContent("en:publicPage.nav:home");
    expect(screen.getByTestId("header-brand")).toHaveTextContent("DB brand");
  });

  it("maps gallery preview tabs to the gallery active nav path", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "gallery" }),
    });

    render(page);

    expect(screen.getByTestId("header-active-path")).toHaveTextContent("zone=gallery");
  });

  it("resolves the explicitly selected durable draft without consuming browser recovery", async () => {
    portfolioDraftFindOne.mockReturnValue({
      lean: vi.fn(async () => ({
        data: {
          home: { content: [{ type: "HeroPreset", props: { id: "selected-draft-home" } }], root: {} },
          gallery: { content: [], root: {} },
          navigation: {
            content: [{ type: "Navigation", props: { id: "shared-navigation", config: { brandText: "Draft brand" } } }],
            root: {},
          },
          footer: { content: [], root: {} },
        },
        brandKit: null,
        contact: { title: "Draft contact" },
        header: { brandText: "Legacy draft brand" },
        collectionsPopup: {},
        formLocale: "",
        formDir: "",
      })),
    });

    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        zone: "home",
        draftId: "66d5f72f3a1e2b4c5d6e7f80",
      }),
    });
    render(page);

    expect(portfolioDraftFindOne).toHaveBeenCalledWith({
      _id: "66d5f72f3a1e2b4c5d6e7f80",
      workspaceId: "workspace-1",
    });
    expect(screen.getByTestId("fallback-home")).toHaveTextContent("selected-draft-home");
    expect(screen.getByTestId("header-brand")).toHaveTextContent("Draft brand");
    expect(screen.getByTestId("preview-client-home")).toHaveAttribute("data-recovery", "false");
  });
});
