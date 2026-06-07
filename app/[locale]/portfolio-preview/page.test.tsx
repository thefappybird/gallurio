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
  runWithRenderWorkspace: vi.fn((_workspace, renderFn: () => React.ReactNode) => renderFn()),
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

vi.mock("@measured/puck/rsc", () => ({
  Render: ({ data }: { data: unknown }) => <pre data-testid="render-data">{JSON.stringify(data)}</pre>,
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

  it("prefers local draft contact and locale state over DB values", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        zone: "contact",
        draft: JSON.stringify({
          contact: { title: "Draft title", description: "Draft description" },
          headerConfig: { brandText: "Draft brand" },
          formLocale: "fil",
        }),
      }),
    });

    render(page);

    expect(screen.getByText("Draft title")).toBeInTheDocument();
    expect(screen.getByText("Draft description")).toBeInTheDocument();
    expect(screen.getByTestId("contact-label")).toHaveTextContent("fil:publicPage.inquiryForm:name");
    expect(screen.getByTestId("header-home")).toHaveTextContent("fil:publicPage.nav:home");
    expect(screen.getByTestId("header-brand")).toHaveTextContent("Draft brand");
  });

  it("prefers local draft zone content over DB draft content", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        zone: "home",
        draft: JSON.stringify({
          data: {
            home: { content: [{ type: "Hero", props: { headline: "Draft Hero" } }], root: {} },
          },
        }),
      }),
    });

    render(page);

    expect(screen.getByTestId("render-data")).toHaveTextContent("Draft Hero");
    expect(screen.getByTestId("render-data")).not.toHaveTextContent("DB Hero");
    expect(screen.getByTestId("header-active-path")).toHaveTextContent("/w/studio-aurora");
  });

  it("maps gallery preview tabs to the gallery active nav path", async () => {
    const page = await PortfolioPreviewPage({
      params: Promise.resolve({ locale: "en" }),
      searchParams: Promise.resolve({
        zone: "gallery",
      }),
    });

    render(page);

    expect(screen.getByTestId("header-active-path")).toHaveTextContent("/w/studio-aurora/gallery");
  });
});
