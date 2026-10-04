import { describe, expect, it, vi } from "vitest";
import { Suspense, type ReactElement } from "react";
import { render, screen } from "@testing-library/react";

let mockFit: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "gw_table_fit_clients" && mockFit ? { value: mockFit } : undefined,
  }),
}));
vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async () => (key: string) => `common:${key}`),
}));
vi.mock("@/lib/i18n/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/auth/requireOrg", () => ({ requireOrg: vi.fn() }));
vi.mock("@/lib/db/mongoose", () => ({ connectDB: vi.fn() }));
vi.mock("./_data/clients-queries", () => ({
  listClients: vi.fn(),
  getWorkspaceTags: vi.fn(),
  resolveDetailClient: vi.fn(),
}));
vi.mock("./_components/clients-page-client", () => ({ ClientsPageClient: () => null }));
vi.mock("@/lib/pricing/workspaceRates", () => ({ getWorkspaceRateMap: vi.fn() }));

import ClientsPage from "./page";

async function renderPage(searchParams: Record<string, string> = {}) {
  const el = (await ClientsPage({
    params: Promise.resolve({ locale: "en" }),
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<{ fallback: ReactElement }>;
  return el;
}

describe("ClientsPage Suspense structure", () => {
  it("wraps the streamed content in Suspense with an accessible busy skeleton fallback", async () => {
    const el = await renderPage();
    expect(el.type).toBe(Suspense);
    render(el.props.fallback);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("common:loading")).toBeInTheDocument();
  });

  it("fallback reserves 10 rows by default, the fit cookie otherwise, and ?limit when valid", async () => {
    const rowsFor = async (sp: Record<string, string>) => {
      const el = await renderPage(sp);
      const { container, unmount } = render(el.props.fallback);
      const n = container.querySelectorAll("table tbody tr").length;
      unmount();
      return n;
    };
    expect(await rowsFor({})).toBe(10);
    mockFit = "14";
    try {
      expect(await rowsFor({})).toBe(14);
      expect(await rowsFor({ limit: "30" })).toBe(30);
    } finally {
      mockFit = undefined;
    }
  });
});
