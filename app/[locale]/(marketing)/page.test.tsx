import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";
import filMessages from "@/messages/fil.json";
import idMessages from "@/messages/id.json";
import arMessages from "@/messages/ar.json";
import thMessages from "@/messages/th.json";

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect called");
  }),
}));

vi.mock("next-intl/server", () => ({
  setRequestLocale: vi.fn(),
  getTranslations: vi.fn(async (arg?: string | { locale?: string; namespace?: string }) => {
    const namespace = typeof arg === "string" ? arg : arg?.namespace;
    return (key: string) => `${namespace}:${key}`;
  }),
}));

const getAuthUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  getAuthUser: () => getAuthUserMock(),
}));

import Home from "./page";

describe("Marketing Home page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAuthUserMock.mockResolvedValue(null);
  });

  it("renders the landing page with the hero headline for an unauthenticated visitor", async () => {
    const page = await Home({ params: Promise.resolve({ locale: "en" }) });
    render(<NextIntlClientProvider locale="en" messages={enMessages}>{page}</NextIntlClientProvider>);

    expect(screen.getByText("marketing:hero.headlineShow")).toBeInTheDocument();
    expect(screen.getByText("marketing:hero.headlineRun")).toBeInTheDocument();
    expect(screen.getByText("marketing:whatIs.body")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "marketing.terms:title" })).toHaveAttribute("href", "/terms");
    expect(screen.getByRole("link", { name: "marketing.privacy:title" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "marketing:footer.refundPolicy" })).toHaveAttribute("href", "/refunds");
    expect(screen.getByRole("link", { name: "marketing:features.portfolioBuilder.cta" })).toHaveClass("bg-brand");
    expect(getAuthUserMock).toHaveBeenCalled();
  });

  it("renders a teams panel alongside the other feature panels", async () => {
    const page = await Home({ params: Promise.resolve({ locale: "en" }) });
    render(<NextIntlClientProvider locale="en" messages={enMessages}>{page}</NextIntlClientProvider>);

    expect(screen.getByText("marketing:features.teams.title")).toBeInTheDocument();
  });

  it("identifies Gallurio in the hero across every launch locale", () => {
    for (const messages of [enMessages, filMessages, idMessages, arMessages, thMessages]) {
      expect(messages.marketing.hero.headlineShow).toMatch(/^Gallurio:\s+\S/);
    }
  });
});
