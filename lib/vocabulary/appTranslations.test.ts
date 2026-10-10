import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({
  peek: vi.fn(),
  locale: vi.fn(),
  plain: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/requireOrg", () => ({ peekOrgContext: h.peek }));

const messages = {
  app: { nav: { inquiries: "%Inquiries%", greeting: "Open your %inquiries%" } },
  common: { save: "Save" },
};
vi.mock("next-intl/server", () => ({
  getLocale: () => h.locale(),
  getMessages: async () => messages,
  getTranslations: (ns?: string) => h.plain(ns),
}));

import { getAppTranslations, getAppMessages } from "./appTranslations";

beforeEach(() => {
  vi.clearAllMocks();
  h.locale.mockResolvedValue("en");
});

describe("getAppTranslations", () => {
  it("applies the workspace preset to app strings", async () => {
    h.peek.mockResolvedValue({ workspace: { vocabularyPreset: "venue" } });
    const t = await getAppTranslations("app.nav");
    expect(t("inquiries")).not.toContain("%");
    expect(t("greeting")).not.toContain("%");
    expect(h.plain).not.toHaveBeenCalled();
  });

  it("falls back to plain getTranslations when signed out", async () => {
    h.peek.mockResolvedValue(null);
    h.plain.mockResolvedValue("PLAIN");
    await expect(getAppTranslations("app.nav")).resolves.toBe("PLAIN");
    expect(h.plain).toHaveBeenCalledWith("app.nav");
  });

  it("respects the request locale", async () => {
    h.peek.mockResolvedValue({ workspace: { vocabularyPreset: "standard" } });
    h.locale.mockResolvedValue("fil");
    const t = await getAppTranslations("common");
    expect(t("save")).toBe("Save");
  });
});

describe("getAppMessages", () => {
  it("returns plain messages when signed out", async () => {
    h.peek.mockResolvedValue(null);
    expect(await getAppMessages()).toBe(messages);
  });
});
