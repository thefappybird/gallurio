// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import type { WorkspaceDoc } from "@/lib/db/models/Workspace";

const headersGetMock = vi.fn<(name: string) => string | null>();

vi.mock("next/headers", () => ({
  headers: async () => ({ get: headersGetMock }),
}));

vi.mock("@/lib/db/queries/publicPage", () => ({
  findPublishedWorkspaceBySlug: vi.fn(),
}));

vi.mock("@/lib/fonts/portfolio", () => ({
  portfolioFontVariables: "font-vars",
}));

// layout.tsx imports PORTFOLIO_SLUG_HEADER from "@/proxy". The real proxy.ts
// calls authkitMiddleware()/createIntlMiddleware() at module scope (see
// proxy.test.ts, which mocks both before importing it) — stub the whole
// module here instead so importing the layout doesn't drag that in.
vi.mock("@/proxy", () => ({ PORTFOLIO_SLUG_HEADER: "x-gallurio-portfolio-slug" }));

import { findPublishedWorkspaceBySlug } from "@/lib/db/queries/publicPage";
import { PORTFOLIO_SLUG_HEADER } from "@/proxy";
import PublicRootLayout from "./layout";

function makeWorkspace(overrides: Partial<{
  formLocale: string | null;
  formDir: "ltr" | "rtl" | "" | null;
}>): WorkspaceDoc {
  return {
    _id: new Types.ObjectId(),
    publicPage: {
      formLocale: overrides.formLocale ?? null,
      formDir: overrides.formDir ?? "",
    },
  } as unknown as WorkspaceDoc;
}

describe("PublicRootLayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function renderHtml(slug: string | null, workspace: WorkspaceDoc | null) {
    headersGetMock.mockImplementation((name: string) => (name === PORTFOLIO_SLUG_HEADER ? slug : null));
    vi.mocked(findPublishedWorkspaceBySlug).mockResolvedValue(workspace as never);
    const element = await PublicRootLayout({ children: null });
    return element.props as { lang: string; dir: string };
  }

  it("renders lang=ar dir=rtl for an Arabic workspace with no formDir override", async () => {
    const html = await renderHtml("acme", makeWorkspace({ formLocale: "ar" }));
    expect(html.lang).toBe("ar");
    expect(html.dir).toBe("rtl");
  });

  it("renders lang=ar dir=ltr when formDir explicitly overrides to ltr", async () => {
    const html = await renderHtml("acme", makeWorkspace({ formLocale: "ar", formDir: "ltr" }));
    expect(html.lang).toBe("ar");
    expect(html.dir).toBe("ltr");
  });

  it.each(["fil", "id", "th"])("renders lang=%s dir=ltr", async (formLocale) => {
    const html = await renderHtml("acme", makeWorkspace({ formLocale }));
    expect(html.lang).toBe(formLocale);
    expect(html.dir).toBe("ltr");
  });

  it("falls back to lang=en dir=ltr when no slug header is present", async () => {
    const html = await renderHtml(null, null);
    expect(html.lang).toBe("en");
    expect(html.dir).toBe("ltr");
    expect(findPublishedWorkspaceBySlug).not.toHaveBeenCalled();
  });

  it("falls back to lang=en dir=ltr when the slug does not resolve to a published workspace", async () => {
    const html = await renderHtml("ghost", null);
    expect(html.lang).toBe("en");
    expect(html.dir).toBe("ltr");
  });
});
