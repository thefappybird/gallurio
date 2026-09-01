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
  PreviewClient: ({
    zone,
    slug,
    workspace,
  }: {
    zone: string;
    slug: string;
    workspace: {
      chrome?: { nav?: { home?: string } };
      previewNav?: { homeHref?: string; galleryHref?: string; activePath?: string };
    };
  }) => (
    <div data-testid="preview-client">
      {zone}:{slug}
      <div data-testid="preview-client-nav-home">{workspace.chrome?.nav?.home ?? ""}</div>
      <div data-testid="preview-client-nav-home-href">{workspace.previewNav?.homeHref ?? ""}</div>
      <div data-testid="preview-client-nav-gallery-href">{workspace.previewNav?.galleryHref ?? ""}</div>
      <div data-testid="preview-client-nav-active-path">{workspace.previewNav?.activePath ?? ""}</div>
    </div>
  ),
}));

import PortfolioPreviewPage from "./page";

describe("PortfolioPreviewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOrg.mockResolvedValue({
      role: "owner",
      workspace: {
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

    const client = screen.getByTestId("preview-client");
    expect(client).toHaveTextContent("home:studio-aurora");
  });

  it("renders PreviewClient for gallery zone with workspace slug", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "gallery" }),
    });

    render(page);

    const client = screen.getByTestId("preview-client");
    expect(client).toHaveTextContent("gallery:studio-aurora");
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
  });

  it("wires chrome.nav labels into the workspace passed to PreviewClient", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "gallery" }),
    });

    render(page);

    expect(screen.getByTestId("preview-client-nav-home")).toHaveTextContent("en:publicPage.nav:home");
  });

  it("wires preview-scoped nav hrefs (stay inside the iframe, not the live public site)", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "home" }),
    });

    render(page);

    expect(screen.getByTestId("preview-client-nav-home-href")).toHaveTextContent(
      "/en/portfolio-preview?zone=home&formLocale=en&formDir=ltr"
    );
    expect(screen.getByTestId("preview-client-nav-gallery-href")).toHaveTextContent(
      "/en/portfolio-preview?zone=gallery&formLocale=en&formDir=ltr"
    );
  });

  it("sets activePath to the home href on the home zone", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "home" }),
    });

    render(page);

    expect(screen.getByTestId("preview-client-nav-active-path")).toHaveTextContent(
      "/en/portfolio-preview?zone=home&formLocale=en&formDir=ltr"
    );
  });

  it("sets activePath to the gallery href on the gallery zone", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({ zone: "gallery" }),
    });

    render(page);

    expect(screen.getByTestId("preview-client-nav-active-path")).toHaveTextContent(
      "/en/portfolio-preview?zone=gallery&formLocale=en&formDir=ltr"
    );
  });
});
