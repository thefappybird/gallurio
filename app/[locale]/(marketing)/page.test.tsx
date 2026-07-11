import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import enMessages from "@/messages/en.json";

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

    expect(screen.getByText("marketing:hero.headline")).toBeInTheDocument();
    expect(getAuthUserMock).toHaveBeenCalled();
  });

  it("renders a teams panel alongside the other feature panels", async () => {
    const page = await Home({ params: Promise.resolve({ locale: "en" }) });
    render(<NextIntlClientProvider locale="en" messages={enMessages}>{page}</NextIntlClientProvider>);

    expect(screen.getByText("marketing:features.teams.title")).toBeInTheDocument();
  });
});
